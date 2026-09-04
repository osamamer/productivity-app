import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AppThemeProvider } from "./contexts/ThemeContext";
import keycloak from './services/keycloak';
import { AppErrorBoundary, AppErrorPage } from './components/AppErrorBoundary';
import { warmAppData } from './services/bootstrap/appBootstrap';
import { prepareAudioFeedback } from './services/audioFeedback';

const REDIRECT_KEY = 'post_auth_redirect';

// Unlock Web Audio during a user gesture so a later API response can play its cue.
window.addEventListener('pointerdown', prepareAudioFeedback, { capture: true });
window.addEventListener('keydown', prepareAudioFeedback, { capture: true });

// Before Keycloak potentially redirects the browser away to the login page,
// save where the user was so we can restore it after they come back.
if (window.location.pathname !== '/') {
    sessionStorage.setItem(REDIRECT_KEY, window.location.pathname);
}

keycloak.init({
    onLoad: 'login-required',
    checkLoginIframe: false,
    pkceMethod: 'S256',
    redirectUri: window.location.origin + '/',
}).then(() => {
    // Keycloak always lands back on '/'. Restore the original path so React
    // Router renders the right page without a second navigation.
    const savedPath = sessionStorage.getItem(REDIRECT_KEY);
    if (savedPath) {
        sessionStorage.removeItem(REDIRECT_KEY);
        window.history.replaceState(null, '', savedPath);
    }

    // Refresh the token before it expires (refresh if < 60s remaining, check every minute)
    setInterval(() => {
        keycloak.updateToken(60).catch(() => keycloak.logout({ redirectUri: window.location.origin + '/' }));
    }, 60_000);

    // Start warming the shared Stats cache while the initial route renders.
    void warmAppData();

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
    console.error('Keycloak initialisation failed', err);
    ReactDOM.createRoot(document.getElementById('root')!).render(<AppErrorPage />);
});
