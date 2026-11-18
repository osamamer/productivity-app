const path = require('node:path');
const dbus = require('dbus-next');
const { claimFocusService } = require('./focusBus');
const { LockScreenWatcher, GNOME_SCREEN_SAVER } = require('./lockScreen');
const { EXTENSION_UUID, installExtension, extensionProblem } = require('./core/gnomeExtension');

const EXTENSION_SOURCE = path.join(__dirname, 'gnome');
// The shell itself, not the `org.gnome.Shell.Extensions` name, which starts a helper process.
const SHELL = 'org.gnome.Shell';
const SHELL_EXTENSIONS = 'org.gnome.Shell.Extensions';
const STATE_POLL_MS = 200;
const STATE_POLL_TRIES = 10;

const unwrap = info => Object.fromEntries(Object.entries(info || {}).map(([key, variant]) => [key, variant?.value]));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Follows the focused window on GNOME through a small GNOME Shell extension that calls back into
 * a D-Bus service this process owns, and follows the lock screen through org.gnome.ScreenSaver.
 *
 * Limitation: GNOME only discovers newly installed extensions at login, so the first time screen
 * time is turned on `start` installs the extension and rejects asking the user to log in again.
 * The extension is turned off when tracking stops; it stays installed so the next start needs
 * no login.
 */
class GnomeFocusWatcher {
    constructor({ extensionDir, onFocus, onTitle, onLockChange }) {
        this.extensionDir = extensionDir;
        this.handlers = { onFocus, onTitle };
        this.onLockChange = onLockChange;
        this.bus = null;
        this.extensions = null;
        this.lockScreen = null;
    }

    async start() {
        this.bus = dbus.sessionBus();
        await claimFocusService(this.bus, this.handlers);
        if (installExtension(EXTENSION_SOURCE, path.join(this.extensionDir, EXTENSION_UUID))) {
            console.info('Installed the screen-time GNOME Shell extension.');
        }
        const object = await this.bus.getProxyObject(SHELL, '/org/gnome/Shell');
        this.extensions = object.getInterface(SHELL_EXTENSIONS);
        const properties = object.getInterface('org.freedesktop.DBus.Properties');
        const userExtensionsEnabled = (await properties.Get(SHELL_EXTENSIONS, 'UserExtensionsEnabled')).value;
        if (userExtensionsEnabled) await this.extensions.EnableExtension(EXTENSION_UUID);
        const problem = extensionProblem(await this.waitForEnabled(), { userExtensionsEnabled });
        if (problem) throw new Error(problem);

        this.lockScreen = new LockScreenWatcher({ bus: this.bus, address: GNOME_SCREEN_SAVER, onChange: this.onLockChange });
        await this.lockScreen.start();
    }

    async waitForEnabled() {
        let info = {};
        for (let attempt = 0; attempt < STATE_POLL_TRIES; attempt++) {
            info = unwrap(await this.extensions.GetExtensionInfo(EXTENSION_UUID));
            if (extensionProblem(info) === null || info.state === undefined) return info;
            await delay(STATE_POLL_MS);
        }
        return info;
    }

    async isLocked() {
        return this.lockScreen ? this.lockScreen.isLocked() : false;
    }

    async stop() {
        if (!this.bus) return;
        try {
            await this.extensions?.DisableExtension(EXTENSION_UUID);
        } catch (error) {
            console.error(`Could not turn off the screen-time GNOME Shell extension: ${error.message}`, error);
        }
        this.lockScreen?.stop();
        this.bus.disconnect();
        this.bus = null;
        this.extensions = null;
    }
}

module.exports = { GnomeFocusWatcher };
