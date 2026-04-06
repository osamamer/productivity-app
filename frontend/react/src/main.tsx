import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AppThemeProvider } from "./contexts/ThemeContext";
import keycloak from './services/keycloak';

const REDIRECT_KEY = 'post_auth_redirect';

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

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <AppThemeProvider>
                <App />
            </AppThemeProvider>
        </React.StrictMode>,
    );
}).catch(err => {
    console.error('Keycloak initialisation failed', err);
});
