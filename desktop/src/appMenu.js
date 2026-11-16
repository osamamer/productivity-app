const { shortcutFor } = require('./shortcuts');

const ZOOM_STEP = 0.5;

function zoomBy(webContents, delta) {
    webContents.setZoomLevel(delta === 0 ? 0 : webContents.getZoomLevel() + delta);
}

/** The entries of the header's ⋮ menu. Local-only folders are hidden in cloud mode. */
function menuItems(mode) {
    const local = mode === 'local';
    return [
        { id: 'changeStorageMode', label: 'Change storage mode…' },
        ...(local
            ? [
                { id: 'openLocalDataFolder', label: 'Open local data folder' },
                { id: 'openLogsFolder', label: 'Open logs folder' },
            ]
            : []),
        { id: 'aboutStorage', label: 'About storage' },
        { separator: true },
        { id: 'reload', label: 'Reload', shortcut: 'Ctrl+R' },
        { id: 'zoomIn', label: 'Zoom in', shortcut: 'Ctrl+=' },
        { id: 'zoomOut', label: 'Zoom out', shortcut: 'Ctrl+-' },
        { id: 'zoomReset', label: 'Actual size', shortcut: 'Ctrl+0' },
        { id: 'fullscreen', label: 'Full screen', shortcut: 'F11' },
        { id: 'devtools', label: 'Developer tools', shortcut: 'Ctrl+Shift+I' },
        { separator: true },
        { id: 'quit', label: 'Quit', shortcut: 'Ctrl+Q' },
    ];
}

/** Every command the menu and the keyboard shortcuts can run, keyed by menu item id. */
function createCommands({ window, content, actions }) {
    return {
        ...actions,
        reload: () => content.webContents.reload(),
        zoomIn: () => zoomBy(content.webContents, ZOOM_STEP),
        zoomOut: () => zoomBy(content.webContents, -ZOOM_STEP),
        zoomReset: () => zoomBy(content.webContents, 0),
        fullscreen: () => window.setFullScreen(!window.isFullScreen()),
        devtools: () => content.webContents.toggleDevTools(),
    };
}

function installShortcuts({ views, commands }) {
    for (const view of views) {
        view.webContents.on('before-input-event', (event, input) => {
            const shortcut = shortcutFor(input);
            if (!shortcut) return;
            event.preventDefault();
            commands[shortcut]();
        });
    }
}

module.exports = { menuItems, createCommands, installShortcuts };
