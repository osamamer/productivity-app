import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import keycloak, {
    clearAuthSession,
    isAccessTokenUsable,
    isDefinitiveRefreshFailure,
    persistAuthSession,
    readAuthSession,
    redirectToSignIn,
    refreshAuthToken,
    restoreAuthSession,
    AUTH_SESSION_STORAGE_KEY,
} from './services/keycloak';
import { isRejectedRefreshError } from './services/auth/authFailures';
import { prepareAudioFeedback } from './services/audioFeedback';
import { isLocalDesktopMode } from './services/desktop';

// Unlock Web Audio during a user gesture so a later API response can play its cue.
window.addEventListener('pointerdown', prepareAudioFeedback, { capture: true });
window.addEventListener('keydown', prepareAudioFeedback, { capture: true });

const authSession = readAuthSession();

keycloak.onAuthSuccess = persistAuthSession;
keycloak.onAuthRefreshSuccess = persistAuthSession;
// No onAuthLogout handler: keycloak-js fires it whenever the token endpoint answers 400, which
// also happens while the identity server is broken. The saved session is cleared explicitly
// instead, when Keycloak rejects it (redirectToSignIn) or the user signs out.
keycloak.onTokenExpired = () => {
    void refreshAuthToken(60).catch((error) => {
        if (isDefinitiveRefreshFailure(error)) {
            redirectToSignIn();
            return;
        }
        console.warn('Could not refresh the expired web session; retrying later', error);
    });
};

const initialization = isLocalDesktopMode
    ? Promise.resolve(true)
    : keycloak.init({
        checkLoginIframe: false,
        ...authSession,
    });

function startTokenRefresh() {
    // Refresh the token before it expires (refresh if < 60s remaining, check every minute)
    window.setInterval(() => {
        void refreshAuthToken(60).catch((error) => {
            if (isDefinitiveRefreshFailure(error)) {
                redirectToSignIn();
                return;
            }
            // A short network or auth-service interruption should not sign the user out.
            console.warn('Could not refresh the web session; retrying later', error);
        });
    }, 60_000);
}

async function renderApp() {
    if (!isLocalDesktopMode) startTokenRefresh();
    if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.register('/service-worker.js')
            .catch(error => console.error('Could not register the notification worker:', error));
    }

    const bootstrapModule = import('./services/bootstrap/appBootstrap');
    const appearanceReady = keycloak.authenticated
        ? bootstrapModule.then(async ({ hydrateCachedUserPreferences, loadUserPreferences }) => {
            if (!hydrateCachedUserPreferences()) await loadUserPreferences();
        })
        : Promise.resolve();

    const [
        { default: App },
        { AppThemeProvider },
        { AppErrorBoundary },
        { warmAppData },
    ] = await Promise.all([
        import('./App.tsx'),
        import('./contexts/ThemeContext'),
        import('./components/AppErrorBoundary'),
        bootstrapModule,
        appearanceReady,
    ]);

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <AppErrorBoundary>
                <AppThemeProvider>
                    <App />
                </AppThemeProvider>
            </AppErrorBoundary>
        </React.StrictMode>,
    );

    if (keycloak.authenticated) {
        window.setTimeout(() => { void warmAppData(); }, 500);
    }
}

window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_SESSION_STORAGE_KEY || event.newValue !== null || !keycloak.authenticated) {
        return;
    }
    redirectToSignIn();
});

const AUTH_RETRY_MS = 30_000;

function renderAuthUnavailable() {
    const root = document.getElementById('root')!;
    root.replaceChildren();
    const panel = document.createElement('div');
    panel.style.cssText = 'max-width:28rem;margin:20vh auto;padding:0 1.5rem;font-family:Roboto,system-ui,sans-serif;text-align:center;line-height:1.5';
    const heading = document.createElement('h1');
    heading.style.cssText = 'font-size:1.4rem;margin-bottom:0.5rem';
    heading.textContent = 'Claritard can’t reach its server';
    const detail = document.createElement('p');
    detail.textContent = 'You are still signed in. The app will reconnect automatically when the server is back.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Try again now';
    retry.style.cssText = 'margin-top:1rem;padding:0.5rem 1.25rem;font:inherit;cursor:pointer';
    retry.addEventListener('click', () => window.location.reload());
    panel.append(heading, detail, retry);
    root.append(panel);
    window.setTimeout(() => window.location.reload(), AUTH_RETRY_MS);
}

/**
 * Returns false when the app cannot start yet. An outage keeps the saved session: only an
 * explicit rejection of the refresh token by Keycloak sends the user to sign in again.
 */
async function recoverFromInitializationFailure(error: unknown): Promise<boolean> {
    console.error('App initialisation failed', error);
    if (await isRejectedRefreshError(error)) {
        clearAuthSession();
        return true;
    }
    if (!restoreAuthSession(authSession)) return true;
    if (isAccessTokenUsable()) {
        console.warn('Keeping the saved web session during a temporary auth failure', error);
        return true;
    }
    renderAuthUnavailable();
    return false;
}

async function bootstrap() {
    try {
        await initialization;
    } catch (error) {
        if (!await recoverFromInitializationFailure(error)) return;
    }

    try {
        if (keycloak.authenticated) {
            persistAuthSession();
        }
        await renderApp();
    } catch (error) {
        console.error('App rendering failed', error);
        document.getElementById('root')!.textContent = 'The app could not be started. Please refresh and try again.';
    }
}

void bootstrap();
