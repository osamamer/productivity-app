const { contextBridge, ipcRenderer } = require('electron');

// The main process answers only for the app's own page, so other origins get no bridge.
const bridge = ipcRenderer.sendSync('desktop:get-bridge');

if (bridge) {
    contextBridge.exposeInMainWorld('claritardDesktop', {
        ...bridge,
        openModeChooser: () => ipcRenderer.send('desktop:open-mode-chooser'),
        showNotification: notification => ipcRenderer.invoke('desktop:show-notification', notification),
        onNotificationClick: callback => {
            const listener = (_event, click) => callback(click.targetUrl);
            ipcRenderer.on('desktop:notification-click', listener);
            return () => ipcRenderer.removeListener('desktop:notification-click', listener);
        },
    });
}

// The custom header follows the page's background so it blends with the app's light or dark
// theme. The app can switch themes at any time without an event we could hook, so poll cheaply.
const THEME_POLL_MS = 1000;
let lastBackground = null;

function reportBackground() {
    if (!document.body) return;
    const background = getComputedStyle(document.body).backgroundColor;
    if (background === lastBackground) return;
    lastBackground = background;
    ipcRenderer.send('desktop:page-background', background);
}

window.addEventListener('DOMContentLoaded', () => {
    reportBackground();
    setInterval(reportBackground, THEME_POLL_MS);
});
