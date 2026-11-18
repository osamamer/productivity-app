const { ipcMain } = require('electron');

/**
 * The web app's screen-time calls. Only the app's own page may make them. Errors reach the page
 * as `{ error }` so it can show the message.
 */
function registerUsageIpc({ usage, isMainAppPage }) {
    const handlers = {
        getStatus: () => usage.getStatus(),
        getRange: (from, to) => usage.getRange(Number(from), Number(to)),
        saveSettings: settings => usage.saveSettings(settings),
    };
    for (const [name, handler] of Object.entries(handlers)) {
        ipcMain.handle(`usage:${name}`, async (event, ...args) => {
            if (!isMainAppPage(event.sender)) return { error: 'Not allowed.' };
            try {
                return { value: await handler(...args) };
            } catch (error) {
                console.error(`usage:${name} failed: ${error.message}`, error);
                return { error: error instanceof Error ? error.message : String(error) };
            }
        });
    }
    return Object.keys(handlers);
}

module.exports = { registerUsageIpc };
