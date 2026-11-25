const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');

const UI_DIR = path.join(__dirname, '..', 'ui');
const PRELOAD = path.join(__dirname, '..', 'timeoutPreload.js');
const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const TICK_MS = 100;
const POPUP_SIZE = { width: 260, height: 64 };
const POPUP_MARGIN = 20;
const POPUP_GAP = 10;

const windowPreferences = {
    preload: PRELOAD,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    spellcheck: false,
};

function themeQuery(appearance) {
    return appearance ? JSON.stringify(appearance) : 'null';
}

/**
 * "A moment before <app>": a countdown that only runs while its window is focused, then opens
 * the app (or enables an Open button). Timing lives here, not in the page, so it cannot be
 * skipped from the page.
 */
class CountdownWindow {
    constructor({ name, seconds, message, autoOpen, appearance, onOpen, onClosed }) {
        this.seconds = seconds;
        this.autoOpen = autoOpen;
        this.onOpen = onOpen;
        this.deadline = null;
        this.opened = false;
        this.window = new BrowserWindow({
            width: 460,
            height: 380,
            resizable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            frame: false,
            alwaysOnTop: true,
            center: true,
            show: false,
            title: `A moment before ${name}`,
            icon: ICON,
            backgroundColor: appearance?.background ?? '#1e2124',
            webPreferences: windowPreferences,
        });
        this.window.on('focus', () => this.syncFocus());
        this.window.on('blur', () => this.syncFocus());
        this.window.once('ready-to-show', () => {
            this.window.show();
            this.window.focus();
        });
        this.window.on('closed', () => {
            clearInterval(this.timer);
            onClosed();
        });
        this.timer = setInterval(() => this.tick(), TICK_MS);
        void this.window.loadFile(path.join(UI_DIR, 'timeout-countdown.html'), {
            query: { name, seconds: String(seconds), message: message || 'Take a breath.', auto: autoOpen ? '1' : '0', theme: themeQuery(appearance) },
        });
    }

    get webContents() {
        return this.window.webContents;
    }

    focus() {
        if (this.window.isDestroyed()) return;
        this.window.show();
        this.window.focus();
    }

    syncFocus() {
        if (this.window.isDestroyed()) return;
        const focused = this.window.isFocused();
        if (focused && this.deadline === null) this.deadline = Date.now() + this.seconds * 1000;
        if (!focused) this.deadline = null;
    }

    remaining() {
        if (this.deadline === null) return this.seconds;
        return Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    }

    tick() {
        if (this.window.isDestroyed()) return;
        this.syncFocus();
        const focused = this.deadline !== null;
        const remaining = this.remaining();
        const ready = focused && remaining === 0;
        this.webContents.send('timeout:state', { remaining, focused, ready });
        if (ready && this.autoOpen) this.open();
    }

    open() {
        this.syncFocus();
        if (this.opened || this.deadline === null || Date.now() < this.deadline) return;
        this.opened = true;
        clearInterval(this.timer);
        try {
            this.onOpen();
        } finally {
            this.close();
        }
    }

    close() {
        if (!this.window.isDestroyed()) this.window.close();
    }
}

/** Small always-on-top "<app> closes in m:ss" windows, stacked in the top-right corner. */
class ClosingPopups {
    constructor() {
        this.popups = new Map();
    }

    show(key, { name, deadline, totalSeconds, appearance, action = 'close' }) {
        if (this.popups.has(key)) return;
        const popup = new BrowserWindow({
            ...POPUP_SIZE,
            frame: false,
            resizable: false,
            movable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            focusable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            show: false,
            type: 'notification',
            title: `${name} ${action === 'minimize' ? 'minimizes' : 'closes'} soon`,
            backgroundColor: appearance?.paper ?? '#26292d',
            webPreferences: windowPreferences,
        });
        popup.setAlwaysOnTop(true, 'screen-saver');
        popup.setVisibleOnAllWorkspaces(true);
        popup.once('ready-to-show', () => popup.showInactive());
        popup.on('closed', () => {
            this.popups.delete(key);
            this.layout();
        });
        this.popups.set(key, popup);
        this.layout();
        void popup.loadFile(path.join(UI_DIR, 'timeout-closing.html'), {
            query: { name, deadline: String(deadline), total: String(totalSeconds), action, theme: themeQuery(appearance) },
        });
    }

    /**
     * Limitation: Wayland compositors decide where windows appear, so the corner placement only
     * applies on X11 (as with any app).
     */
    layout() {
        const area = screen.getPrimaryDisplay().workArea;
        let index = 0;
        for (const popup of this.popups.values()) {
            if (popup.isDestroyed()) continue;
            popup.setPosition(
                Math.round(area.x + area.width - POPUP_SIZE.width - POPUP_MARGIN),
                Math.round(area.y + POPUP_MARGIN + index * (POPUP_SIZE.height + POPUP_GAP)),
            );
            index += 1;
        }
    }

    close(key) {
        const popup = this.popups.get(key);
        if (popup && !popup.isDestroyed()) popup.close();
    }

    closeAll() {
        for (const key of [...this.popups.keys()]) this.close(key);
    }
}

/** Routes the countdown page's buttons to the window that sent them. */
function installCountdownIpc(findCountdown) {
    ipcMain.on('timeout:open', event => findCountdown(event.sender)?.open());
    ipcMain.on('timeout:cancel', event => findCountdown(event.sender)?.close());
}

module.exports = { CountdownWindow, ClosingPopups, installCountdownIpc };
