import Keycloak from 'keycloak-js';

// The app-owned password form cannot rely on the redirect-only, memory-only behavior of
// keycloak-js. Tokens are scoped to this browser tab, but any XSS running in the app could
// still read them; replacing this with an HttpOnly backend session requires a BFF design.
const AUTH_SESSION_KEY = 'claritard_auth_session';

interface AuthSession {
    token: string;
    refreshToken: string;
    idToken?: string;
}

interface PasswordGrantResponse {
    access_token: string;
    refresh_token: string;
    id_token?: string;
}

export interface RegistrationDetails {
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    password: string;
}

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || '/auth';
const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'productivity-app';
const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'productivity-app-frontend';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const keycloak = new Keycloak({
    url: keycloakUrl,
    realm,
    clientId,
});

export function readAuthSession(): Partial<AuthSession> {
    try {
        const stored = sessionStorage.getItem(AUTH_SESSION_KEY);
        if (!stored) return {};

        const session = JSON.parse(stored) as Partial<AuthSession>;
        if (typeof session.token !== 'string' || typeof session.refreshToken !== 'string') {
            clearAuthSession();
            return {};
        }
        return session;
    } catch (error) {
        console.warn('Could not restore the authentication session', error);
        clearAuthSession();
        return {};
    }
}

export function persistAuthSession(): void {
    if (!keycloak.authenticated || !keycloak.token || !keycloak.refreshToken) {
        clearAuthSession();
        return;
    }

    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        token: keycloak.token,
        refreshToken: keycloak.refreshToken,
        idToken: keycloak.idToken,
    } satisfies AuthSession));
}

export function clearAuthSession(): void {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
}

export async function authenticateWithPassword(username: string, password: string): Promise<void> {
    // Direct access grants keep the browser on /sign-in, but they intentionally do not support
    // redirect-based identity features such as social providers or most MFA flows.
    const response = await fetch(`${keycloakUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'password',
            client_id: clientId,
            scope: 'openid',
            username,
            password,
        }),
    });

    if (!response.ok) {
        throw new Error('SIGN_IN_FAILED');
    }

    const tokens = await response.json() as PasswordGrantResponse;
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        token: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
    } satisfies AuthSession));
}

export async function registerAccount(details: RegistrationDetails): Promise<void> {
    let response: Response;
    try {
        response = await fetch(`${apiUrl}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(details),
        });
    } catch (error) {
        console.error('Account registration request failed', error);
        throw new Error('Account creation is temporarily unavailable.');
    }

    if (!response.ok) {
        const message = response.status === 400 ? await response.text() : '';
        throw new Error(message || 'Account creation is temporarily unavailable.');
    }
}

export async function endCurrentSession(): Promise<void> {
    const refreshToken = keycloak.refreshToken;
    if (refreshToken) {
        await fetch(`${keycloakUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                refresh_token: refreshToken,
            }),
        }).catch((error) => console.error('Could not end the authentication session', error));
    }

    clearAuthSession();
    keycloak.clearToken();
}

export default keycloak;
