const { ipcMain } = require('electron');

/**
 * The Boundaries page's calls. Only the app's own page may make them. Errors reach the page as
 * `{ error }` so it can show the message instead of a generic IPC failure.
 */
function registerTimeoutIpc({ timeouts, isMainAppPage }) {
    const handlers = {
        getState: () => timeouts.getState(),
        lockReason: appId => timeouts.lockReason(String(appId)),
        saveApp: (appId, settings) => timeouts.saveApp(String(appId), settings),
        removeApp: appId => timeouts.removeApp(String(appId)),
        saveUrl: (previousUrl, url, settings) => timeouts.saveUrl(previousUrl ? String(previousUrl) : null, String(url), settings),
        removeUrl: url => timeouts.removeUrl(String(url)),
        editStatus: () => timeouts.editStatus(),
        setEditPassword: password => timeouts.setEditPassword(String(password)),
        unlockEditing: password => timeouts.unlockEditing(String(password)),
        lockEditing: () => timeouts.lockEditing(),
        installBrowserHost: () => timeouts.installBrowserHost(),
        openExtensionFolder: () => timeouts.openExtensionFolder(),
        setAppearance: appearance => timeouts.setAppearance(appearance),
        setCountdownDisplay: value => timeouts.setCountdownDisplay(String(value)),
    };
    for (const [name, handler] of Object.entries(handlers)) {
        ipcMain.handle(`timeouts:${name}`, async (event, ...args) => {
            if (!isMainAppPage(event.sender)) return { error: 'Not allowed.' };
            try {
                return { value: await handler(...args) };
            } catch (error) {
                console.error(`timeouts:${name} failed:`, error);
                return { error: error instanceof Error ? error.message : String(error) };
            }
        });
    }
    return Object.keys(handlers);
}

module.exports = { registerTimeoutIpc };
