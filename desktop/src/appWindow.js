const { BaseWindow, WebContentsView } = require('electron');
const path = require('node:path');

const HEADER_HEIGHT = 40;
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');

const isolatedPreferences = {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
};

/**
 * A frameless window with the app's own header on top and the web app below it. The two live
 * in separate views so the header works the same for the bundled local app and for the
 * hosted cloud site, without touching either page.
 */
function createAppWindow({ mode, contentPreferences = {}, show = true }) {
    const window = new BaseWindow({
        width: 1320,
        height: 860,
        minWidth: 420,
        minHeight: 560,
        frame: false,
        backgroundColor: '#100e14',
        title: 'Claritard',
        icon: ICON,
        show,
    });
    const header = new WebContentsView({
        webPreferences: { ...isolatedPreferences, preload: path.join(__dirname, 'headerPreload.js'), spellcheck: false },
    });
    const content = new WebContentsView({
        webPreferences: {
            ...isolatedPreferences,
            preload: path.join(__dirname, 'preload.js'),
            // The window usually sits hidden in the tray while a Pomodoro runs. With throttling,
            // Chromium slows the page's timers to once a minute, so status refreshes, notification
            // sync and token refresh fall behind and transitions arrive late or not at all.
            backgroundThrottling: false,
            ...contentPreferences,
        },
    });
    header.setBackgroundColor('#100e14');
    content.setBackgroundColor('#100e14');
    window.contentView.addChildView(content);
    window.contentView.addChildView(header);

    const layout = () => {
        const { width, height } = window.getContentBounds();
        const headerHeight = window.isFullScreen() ? 0 : HEADER_HEIGHT;
        header.setBounds({ x: 0, y: 0, width, height: headerHeight });
        content.setBounds({ x: 0, y: headerHeight, width, height: Math.max(0, height - headerHeight) });
    };
    const sendWindowState = () => {
        if (header.webContents.isDestroyed()) return;
        header.webContents.send('header:window-state', { maximized: window.isMaximized() });
    };
    for (const event of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
        window.on(event, () => {
            layout();
            sendWindowState();
        });
    }
    header.webContents.on('did-finish-load', sendWindowState);
    layout();

    // Views are not destroyed with their window, so release them explicitly.
    window.on('closed', () => {
        header.webContents.close();
        content.webContents.close();
    });

    void header.webContents.loadFile(path.join(__dirname, 'ui', 'header.html'), { query: { mode } });
    return { window, header, content };
}

module.exports = { createAppWindow, HEADER_HEIGHT };
