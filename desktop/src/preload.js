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
        timeouts: timeoutsBridge(),
        usage: usageBridge(),
    });
}

/** Calls a main-process handler; resolves to its value or rejects with the shell's message. */
function caller(prefix) {
    return name => async (...args) => {
        const result = await ipcRenderer.invoke(`${prefix}:${name}`, ...args);
        if (result?.error) throw new Error(result.error);
        return result?.value;
    };
}

/** Desktop screen time, kept on this computer. */
function usageBridge() {
    const call = caller('usage');
    return {
        getStatus: call('getStatus'),
        getRange: call('getRange'),
        getDailyTotals: call('getDailyTotals'),
        assignActivity: call('assignActivity'),
        getActivityTime: call('getActivityTime'),
        saveSettings: call('saveSettings'),
    };
}

/** App and Firefox URL timeouts. */
function timeoutsBridge() {
    const call = caller('timeouts');
    return {
        getState: call('getState'),
        lockReason: call('lockReason'),
        saveApp: call('saveApp'),
        removeApp: call('removeApp'),
        saveUrl: call('saveUrl'),
        removeUrl: call('removeUrl'),
        editStatus: call('editStatus'),
        setEditPassword: call('setEditPassword'),
        unlockEditing: call('unlockEditing'),
        lockEditing: call('lockEditing'),
        installBrowserHost: call('installBrowserHost'),
        openExtensionFolder: call('openExtensionFolder'),
        setAppearance: call('setAppearance'),
    };
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
