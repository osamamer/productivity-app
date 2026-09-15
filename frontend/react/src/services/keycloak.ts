import Keycloak from 'keycloak-js';

// The app-owned password form needs to restore its refresh session after a browser restart.
// The values remain readable by JavaScript; moving the refresh token to an HttpOnly cookie
// would require a backend-for-frontend session design.
export const AUTH_SESSION_STORAGE_KEY = 'claritard_auth_session';
const REFRESH_RETRY_DELAYS_MS = [250, 1_000];

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

function readStorageValue(storage: Storage, key: string): string | null {
    try {
        return storage.getItem(key);
    } catch (error) {
        console.error('Could not read the saved authentication session', error);
        return null;
    }
}

function writeStorageValue(storage: Storage, key: string, value: string): boolean {
    try {
        storage.setItem(key, value);
        return true;
    } catch (error) {
        console.error('Could not save the authentication session', error);
        return false;
    }
}

function removeStorageValue(storage: Storage, key: string): void {
    try {
        storage.removeItem(key);
    } catch (error) {
        console.error('Could not clear the saved authentication session', error);
    }
}

function parseAuthSession(stored: string): Partial<AuthSession> | null {
    try {
        const session = JSON.parse(stored) as Partial<AuthSession>;
        if (typeof session.token !== 'string' || typeof session.refreshToken !== 'string') {
            return null;
        }
        return session;
    } catch (error) {
        console.warn('Could not restore the authentication session', error);
        return null;
    }
}

export function readAuthSession(): Partial<AuthSession> {
    const persistentSession = readStorageValue(localStorage, AUTH_SESSION_STORAGE_KEY);
    const legacySession = readStorageValue(sessionStorage, AUTH_SESSION_STORAGE_KEY);

    for (const [stored, isLegacy] of [
        [persistentSession, false],
        [legacySession, true],
    ] as const) {
        if (!stored) continue;

        const session = parseAuthSession(stored);
        if (!session) {
            removeStorageValue(
                isLegacy ? sessionStorage : localStorage,
                AUTH_SESSION_STORAGE_KEY,
            );
            continue;
        }

        if (isLegacy && writeStorageValue(localStorage, AUTH_SESSION_STORAGE_KEY, stored)) {
            removeStorageValue(sessionStorage, AUTH_SESSION_STORAGE_KEY);
        }
        return session;
    }

    clearAuthSession();
    return {};
}

export function persistAuthSession(): void {
    if (!keycloak.authenticated || !keycloak.token || !keycloak.refreshToken) {
        clearAuthSession();
        return;
    }

    const session = JSON.stringify({
        token: keycloak.token,
        refreshToken: keycloak.refreshToken,
        idToken: keycloak.idToken,
    } satisfies AuthSession);

    // Keep a session-storage fallback for browsers that disable persistent storage.
    if (writeStorageValue(localStorage, AUTH_SESSION_STORAGE_KEY, session)) {
        removeStorageValue(sessionStorage, AUTH_SESSION_STORAGE_KEY);
    } else {
        writeStorageValue(sessionStorage, AUTH_SESSION_STORAGE_KEY, session);
    }
}

export function clearAuthSession(): void {
    removeStorageValue(localStorage, AUTH_SESSION_STORAGE_KEY);
    removeStorageValue(sessionStorage, AUTH_SESSION_STORAGE_KEY);
}

function responseStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;

    const response = (error as { response?: unknown }).response;
    if (typeof response !== 'object' || response === null || !('status' in response)) return undefined;

    const status = (response as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
}

export function isDefinitiveRefreshFailure(error: unknown): boolean {
    const status = responseStatus(error);
    return status === 400 || status === 401 || !keycloak.token || !keycloak.refreshToken;
}

const wait = (milliseconds: number) => new Promise<void>(resolve => {
    window.setTimeout(resolve, milliseconds);
});

async function refreshWithRetry(minValidity: number): Promise<boolean> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= REFRESH_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
            const refreshed = await keycloak.updateToken(minValidity);
            persistAuthSession();
            return refreshed;
        } catch (error) {
            lastError = error;
            if (isDefinitiveRefreshFailure(error) || attempt === REFRESH_RETRY_DELAYS_MS.length) {
                throw error;
            }
            await wait(REFRESH_RETRY_DELAYS_MS[attempt]);
        }
    }

    throw lastError;
}

let refreshInFlight: Promise<boolean> | null = null;

// All timer, API, and WebSocket callers share one refresh operation. This prevents a burst of
// requests from independently racing the refresh-token endpoint and invalidating one another.
export function refreshAuthToken(minValidity = 30): Promise<boolean> {
    if (!keycloak.authenticated || !keycloak.refreshToken) return Promise.resolve(false);
    if (refreshInFlight) return refreshInFlight;

    const request = refreshWithRetry(minValidity);
    refreshInFlight = request;
    void request.then(
        () => {
            if (refreshInFlight === request) refreshInFlight = null;
        },
        () => {
            if (refreshInFlight === request) refreshInFlight = null;
        },
    );
    return request;
}

export function redirectToSignIn(): void {
    clearAuthSession();
    keycloak.clearToken();
    if (window.location.pathname !== '/sign-in') {
        window.location.replace('/sign-in');
    }
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
            scope: 'openid profile email offline_access',
            username,
            password,
        }),
    });

    if (!response.ok) {
        throw new Error('SIGN_IN_FAILED');
    }

    const tokens = await response.json() as PasswordGrantResponse;
    if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('SIGN_IN_FAILED');
    }

    const session = JSON.stringify({
        token: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
    } satisfies AuthSession);
    if (!writeStorageValue(localStorage, AUTH_SESSION_STORAGE_KEY, session)) {
        writeStorageValue(sessionStorage, AUTH_SESSION_STORAGE_KEY, session);
    }
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
