import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import keycloak, {
    clearAuthSession,
    persistAuthSession,
    readAuthSession,
} from './services/keycloak';
import { prepareAudioFeedback } from './services/audioFeedback';

// Unlock Web Audio during a user gesture so a later API response can play its cue.
window.addEventListener('pointerdown', prepareAudioFeedback, { capture: true });
window.addEventListener('keydown', prepareAudioFeedback, { capture: true });

const authSession = readAuthSession();

keycloak.onAuthSuccess = persistAuthSession;
keycloak.onAuthRefreshSuccess = persistAuthSession;
keycloak.onAuthLogout = clearAuthSession;

keycloak.init({
    checkLoginIframe: false,
    ...authSession,
}).then(async () => {
    // Refresh the token before it expires (refresh if < 60s remaining, check every minute)
    setInterval(() => {
        if (!keycloak.authenticated) return;

        keycloak.updateToken(60)
            .then(persistAuthSession)
            .catch(() => {
                clearAuthSession();
                keycloak.clearToken();
                window.location.replace('/sign-in');
            });
    }, 60_000);

    if (keycloak.authenticated) {
        persistAuthSession();
    }

    const [
        { default: App },
        { AppThemeProvider },
        { AppErrorBoundary },
        { warmAppData },
    ] = await Promise.all([
        import('./App.tsx'),
        import('./contexts/ThemeContext'),
        import('./components/AppErrorBoundary'),
        import('./services/bootstrap/appBootstrap'),
    ]);

    if (keycloak.authenticated) {
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
}).catch(err => {
    console.error('App initialisation failed', err);
    document.getElementById('root')!.textContent = 'The app could not be started. Please refresh and try again.';
});
