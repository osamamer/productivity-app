const { WebContentsView } = require('electron');
const path = require('node:path');

// Room around the panel for its shadow; the view itself is transparent.
const SHADOW_PADDING = 12;
// A click on ⋮ while the menu is open first blurs (closing it), then clicks; don't reopen.
const REOPEN_GUARD_MS = 250;

/**
 * The ⋮ menu, drawn by the app so it follows the page's light or dark theme (native popups use
 * the desktop's theme instead). It is a transparent view laid over the window only while open.
 */
class PopupMenu {
    constructor({ window, items, closeOnPressIn = [] }) {
        this.window = window;
        this.isOpen = false;
        this.lastClosedAt = 0;
        this.size = { width: 280, height: 420 };
        this.view = new WebContentsView({
            webPreferences: {
                preload: path.join(__dirname, 'menuPreload.js'),
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false,
                spellcheck: false,
            },
        });
        this.view.setBackgroundColor('#00000000');
        this.view.webContents.on('did-finish-load', () => this.view.webContents.send('menu:items', items));
        this.view.webContents.on('blur', () => this.close());
        // Focus does not always move between views on a click, so pressing anywhere else closes too.
        for (const other of closeOnPressIn) {
            other.webContents.on('before-mouse-event', (_event, mouse) => {
                if (mouse.type === 'mouseDown') this.close();
            });
        }
        for (const event of ['resize', 'blur', 'enter-full-screen', 'leave-full-screen']) {
            window.on(event, () => this.close());
        }
        void this.view.webContents.loadFile(path.join(__dirname, 'ui', 'menu.html'));
    }

    get webContents() {
        return this.view.webContents;
    }

    setPanelSize({ width, height }) {
        this.size = {
            width: Math.ceil(width) + SHADOW_PADDING * 2,
            height: Math.ceil(height) + SHADOW_PADDING * 2,
        };
    }

    setTheme(background) {
        this.view.webContents.send('menu:theme', { background });
    }

    /** Opens below the anchor, right-aligned with it, kept inside the window. */
    toggle(anchor) {
        if (this.isOpen) {
            this.close();
            return;
        }
        if (Date.now() - this.lastClosedAt < REOPEN_GUARD_MS) return;
        const { width: windowWidth } = this.window.getContentBounds();
        const x = Math.max(0, Math.min(anchor.right + SHADOW_PADDING - this.size.width, windowWidth - this.size.width));
        const y = Math.max(0, anchor.bottom + 4 - SHADOW_PADDING);
        // Adding the view again moves it to the top of the stack.
        this.window.contentView.addChildView(this.view);
        this.view.setBounds({ x, y, width: this.size.width, height: this.size.height });
        this.isOpen = true;
        this.view.webContents.focus();
        this.view.webContents.send('menu:opened');
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.lastClosedAt = Date.now();
        this.window.contentView.removeChildView(this.view);
    }

    destroy() {
        this.view.webContents.close();
    }
}

module.exports = { PopupMenu };
