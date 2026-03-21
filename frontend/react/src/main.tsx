import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AppThemeProvider } from "./contexts/ThemeContext";
import keycloak from './services/keycloak';

keycloak.init({
    onLoad: 'login-required',
    checkLoginIframe: false,
    pkceMethod: 'S256',
}).then(() => {
    // Refresh the token before it expires (refresh if < 60s remaining, check every minute)
    setInterval(() => {
        keycloak.updateToken(60).catch(() => keycloak.logout());
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
