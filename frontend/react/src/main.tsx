import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import keycloak, {
    clearAuthSession,
    isDefinitiveRefreshFailure,
    persistAuthSession,
    readAuthSession,
    redirectToSignIn,
    refreshAuthToken,
    AUTH_SESSION_STORAGE_KEY,
} from './services/keycloak';
import { prepareAudioFeedback } from './services/audioFeedback';

// Unlock Web Audio during a user gesture so a later API response can play its cue.
window.addEventListener('pointerdown', prepareAudioFeedback, { capture: true });
window.addEventListener('keydown', prepareAudioFeedback, { capture: true });

const authSession = readAuthSession();

keycloak.onAuthSuccess = persistAuthSession;
keycloak.onAuthRefreshSuccess = persistAuthSession;
keycloak.onAuthLogout = clearAuthSession;
keycloak.onTokenExpired = () => {
    void refreshAuthToken(60).catch((error) => {
        if (isDefinitiveRefreshFailure(error)) {
            redirectToSignIn();
            return;
        }
        console.warn('Could not refresh the expired web session; retrying later', error);
    });
};

const initialization = keycloak.init({
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
    startTokenRefresh();

    const [
        { default: App },
        { AppThemeProvider },
        { AppErrorBoundary },
        { loadUserPreferences, warmAppData },
    ] = await Promise.all([
        import('./App.tsx'),
        import('./contexts/ThemeContext'),
        import('./components/AppErrorBoundary'),
        import('./services/bootstrap/appBootstrap'),
    ]);

    if (keycloak.authenticated) {
        await loadUserPreferences();
        void warmAppData();
    }

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <AppErrorBoundary>
                <AppThemeProvider>
                    <App />
                </AppThemeProvider>
            </AppErrorBoundary>
        </React.StrictMode>,
    );
}

window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_SESSION_STORAGE_KEY || event.newValue !== null || !keycloak.authenticated) {
        return;
    }
    redirectToSignIn();
});

async function bootstrap() {
    try {
        await initialization;
    } catch (error) {
        console.error('App initialisation failed', error);

        // Keep the in-memory session during a temporary Keycloak outage. The saved refresh
        // session will be retried by the timer once the auth service is reachable again.
        if (keycloak.authenticated && keycloak.token && keycloak.refreshToken) {
            console.warn('Keeping the existing web session after a temporary auth failure', error);
        } else {
            clearAuthSession();
        }
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
