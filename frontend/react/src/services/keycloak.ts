import Keycloak from 'keycloak-js';

const DEV_AUTH_SESSION_KEY = 'claritard_dev_auth_session';

// Development-only compromise: keeping tokens per tab avoids a full OIDC redirect on every
// Vite reload. Production deliberately remains memory-only to limit token exposure to XSS.
interface DevAuthSession {
    token: string;
    refreshToken: string;
    idToken?: string;
}

const keycloak = new Keycloak({
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:7070',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'productivity-app',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'productivity-app-frontend',
});

export function readDevAuthSession(): Partial<DevAuthSession> {
    if (!import.meta.env.DEV) return {};

    try {
        const stored = sessionStorage.getItem(DEV_AUTH_SESSION_KEY);
        if (!stored) return {};

        const session = JSON.parse(stored) as Partial<DevAuthSession>;
        if (typeof session.token !== 'string' || typeof session.refreshToken !== 'string') {
            clearDevAuthSession();
            return {};
        }
        return session;
    } catch (error) {
        console.warn('Could not restore the development authentication session', error);
        clearDevAuthSession();
        return {};
    }
}

export function persistDevAuthSession(): void {
    if (!import.meta.env.DEV) return;

    if (!keycloak.authenticated || !keycloak.token || !keycloak.refreshToken) {
        clearDevAuthSession();
        return;
    }

    sessionStorage.setItem(DEV_AUTH_SESSION_KEY, JSON.stringify({
        token: keycloak.token,
        refreshToken: keycloak.refreshToken,
        idToken: keycloak.idToken,
    } satisfies DevAuthSession));
}

export function clearDevAuthSession(): void {
    if (import.meta.env.DEV) {
        sessionStorage.removeItem(DEV_AUTH_SESSION_KEY);
    }
}

export default keycloak;
