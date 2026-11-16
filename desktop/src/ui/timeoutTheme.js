// Applies the web app's theme, passed in the page's query string, to the timeout windows.
// eslint-disable-next-line no-unused-vars
function applyTimeoutTheme() {
    let theme;
    try {
        theme = JSON.parse(new URLSearchParams(location.search).get('theme') || 'null');
    } catch {
        theme = null;
    }
    if (!theme) return;
    const root = document.documentElement.style;
    const light = theme.mode === 'light';
    const set = (name, value) => {
        if (typeof value === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value)) root.setProperty(name, value);
    };
    root.setProperty('color-scheme', light ? 'light' : 'dark');
    set('--bg', theme.background);
    set('--paper', theme.paper);
    set('--text', theme.text);
    set('--muted', theme.textSecondary);
    set('--accent', theme.primary);
    set('--on-accent', theme.onPrimary);
    set('--border', light ? 'rgba(26, 26, 46, 0.1)' : 'rgba(255, 255, 255, 0.09)');
    set('--track', light ? 'rgba(26, 26, 46, 0.07)' : 'rgba(255, 255, 255, 0.08)');
}

applyTimeoutTheme();
