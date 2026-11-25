import Keycloak, { type KeycloakTokenParsed } from 'keycloak-js';
import { isLocalDesktopMode, localDesktopToken } from './desktop';
import { isInvalidGrantResponse, isRejectedRefreshError } from './auth/authFailures';
import { type RefreshedTokens, requestTokenRefresh } from './auth/tokenRefresh';

// The app-owned password form needs to restore its refresh session after a browser restart.
// The values remain readable by JavaScript; moving the refresh token to an HttpOnly cookie
// would require a backend-for-frontend session design.
export const AUTH_SESSION_STORAGE_KEY = 'claritard_auth_session';
const REFRESH_RETRY_DELAYS_MS = [250, 1_000];

export const SIGN_IN_REJECTED = 'SIGN_IN_REJECTED';
export const SIGN_IN_UNAVAILABLE = 'SIGN_IN_UNAVAILABLE';

/** Keycloak checked the saved refresh token and rejected it; the user must sign in again. */
export class SessionRejectedError extends Error {
    readonly response: unknown;

    constructor(refreshError: unknown) {
        super('The saved session was rejected by the identity server');
        this.name = 'SessionRejectedError';
        this.response = (refreshError as { response?: unknown } | null)?.response;
    }
}

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

const tokenEndpoint = () => `${keycloakUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`;

function decodeTokenPayload(token: string): KeycloakTokenParsed {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)) as KeycloakTokenParsed;
}

// Local desktop mode has no identity server: the shell hands over a ready token and
// keycloak.init() is never called, so every existing token reader keeps working unchanged.
if (localDesktopToken) {
    keycloak.token = localDesktopToken;
    keycloak.tokenParsed = decodeTokenPayload(localDesktopToken);
    keycloak.subject = keycloak.tokenParsed.sub;
    keycloak.authenticated = true;
}

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

export function isDefinitiveRefreshFailure(error: unknown): boolean {
    return error instanceof SessionRejectedError || !keycloak.token || !keycloak.refreshToken;
}

/**
 * Puts a saved session back into keycloak-js. keycloak-js discards its tokens on any HTTP 400
 * from the token endpoint, including server-side errors during an outage, which would
 * otherwise turn a temporary outage into a sign-out.
 */
export function restoreAuthSession(session: Partial<AuthSession>): boolean {
    if (!session.token || !session.refreshToken) return false;
    keycloak.token = session.token;
    keycloak.tokenParsed = decodeTokenPayload(session.token);
    keycloak.refreshToken = session.refreshToken;
    keycloak.refreshTokenParsed = decodeTokenPayload(session.refreshToken);
    if (session.idToken) {
        keycloak.idToken = session.idToken;
        keycloak.idTokenParsed = decodeTokenPayload(session.idToken);
    }
    keycloak.subject = keycloak.tokenParsed.sub;
    keycloak.authenticated = true;
    return true;
}

export function isAccessTokenUsable(nowMs = Date.now()): boolean {
    const expiresAt = keycloak.tokenParsed?.exp;
    return typeof expiresAt === 'number' && expiresAt * 1000 > nowMs;
}

const wait = (milliseconds: number) => new Promise<void>(resolve => {
    window.setTimeout(resolve, milliseconds);
});

// Mirrors what keycloak-js does with a refresh response, including its clock-skew estimate.
// It does not reschedule keycloak-js's onTokenExpired timer; the minute-by-minute refresh in
// main.tsx renews the token before it expires.
function applyRefreshedTokens(tokens: RefreshedTokens, timeLocalMs: number): void {
    restoreAuthSession({ token: tokens.access_token, refreshToken: tokens.refresh_token, idToken: tokens.id_token });
    if (!tokens.id_token) {
        delete keycloak.idToken;
        delete keycloak.idTokenParsed;
    }
    const issuedAt = keycloak.tokenParsed?.iat;
    if (typeof issuedAt === 'number') keycloak.timeSkew = Math.floor(timeLocalMs / 1000) - issuedAt;
}

/** keycloak.updateToken with a timeout; see tokenRefresh.ts for why it does not call keycloak-js. */
async function updateToken(minValidity: number): Promise<boolean> {
    if (!keycloak.refreshToken) throw new Error('Unable to update token, no refresh token available.');
    if (!keycloak.isTokenExpired(minValidity)) return false;

    const startedAt = Date.now();
    const tokens = await requestTokenRefresh(tokenEndpoint(), keycloak.refreshToken, clientId);
    applyRefreshedTokens(tokens, (startedAt + Date.now()) / 2);
    return true;
}

async function refreshWithRetry(minValidity: number): Promise<boolean> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= REFRESH_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
            const refreshed = await updateToken(minValidity);
            persistAuthSession();
            return refreshed;
        } catch (error) {
            if (await isRejectedRefreshError(error)) throw new SessionRejectedError(error);
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
    if (isLocalDesktopMode) {
        console.error('The local desktop backend rejected its session token');
        return;
    }
    clearAuthSession();
    keycloak.clearToken();
    if (window.location.pathname !== '/sign-in') {
        window.location.replace('/sign-in');
    }
}

export async function authenticateWithPassword(username: string, password: string): Promise<void> {
    // Direct access grants keep the browser on /sign-in, but they intentionally do not support
    // redirect-based identity features such as social providers or most MFA flows.
    let response: Response;
    try {
        response = await fetch(tokenEndpoint(), {
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
    } catch (error) {
        console.error('The sign-in service could not be reached', error);
        throw new Error(SIGN_IN_UNAVAILABLE);
    }

    if (!response.ok) {
        if (await isInvalidGrantResponse(response)) throw new Error(SIGN_IN_REJECTED);
        console.error(`The sign-in service failed with HTTP ${response.status}`);
        throw new Error(SIGN_IN_UNAVAILABLE);
    }

    const tokens = await response.json() as PasswordGrantResponse;
    if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error(SIGN_IN_UNAVAILABLE);
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
    if (isLocalDesktopMode) return;
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
