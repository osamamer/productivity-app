const fs = require('node:fs');
const path = require('node:path');
const dbus = require('dbus-next');
const { claimFocusService } = require('./focusBus');
const { LockScreenWatcher, KDE_SCREEN_SAVER } = require('./lockScreen');

const SCRIPT_NAME = 'claritard-usage';
const SCRIPT_SOURCE = path.join(__dirname, 'kwin', 'claritard-usage.js');

/**
 * Follows the focused window on KDE Plasma 6 through a small KWin script that calls back into
 * a D-Bus service this process owns (app id, caption, fullscreen and process id), and follows the lock screen through the ScreenSaver
 * interface.
 *
 * The script is copied out of the app bundle because KWin cannot read inside the asar archive.
 */
class KWinFocusWatcher {
    constructor({ scriptFile, onFocus, onTitle, onLockChange }) {
        this.scriptFile = scriptFile;
        this.handlers = { onFocus, onTitle };
        this.onLockChange = onLockChange;
        this.bus = null;
        this.lockScreen = null;
    }

    async callScripting(member, signature, body) {
        // Called raw because dbus-next's proxy cannot pick between loadScript's overloads.
        const reply = await this.bus.call(new dbus.Message({
            destination: 'org.kde.KWin',
            path: '/Scripting',
            interface: 'org.kde.kwin.Scripting',
            member,
            signature,
            body,
        }));
        return reply.body[0];
    }

    async start() {
        this.bus = dbus.sessionBus();
        await claimFocusService(this.bus, this.handlers);

        fs.mkdirSync(path.dirname(this.scriptFile), { recursive: true });
        fs.copyFileSync(SCRIPT_SOURCE, this.scriptFile);
        // A script left behind by a crash would report twice, so replace it.
        await this.callScripting('unloadScript', 's', [SCRIPT_NAME]);
        const id = await this.callScripting('loadScript', 'ss', [this.scriptFile, SCRIPT_NAME]);
        if (id < 0) throw new Error('KWin refused to load the screen-time script.');
        await this.callScripting('start', '', []);
        this.lockScreen = new LockScreenWatcher({ bus: this.bus, address: KDE_SCREEN_SAVER, onChange: this.onLockChange });
        await this.lockScreen.start();
    }

    async isLocked() {
        return this.lockScreen ? this.lockScreen.isLocked() : false;
    }

    async stop() {
        if (!this.bus) return;
        try {
            await this.callScripting('unloadScript', 's', [SCRIPT_NAME]);
        } catch (error) {
            console.error(`Could not unload the screen-time KWin script: ${error.message}`, error);
        }
        this.lockScreen?.stop();
        this.bus.disconnect();
        this.bus = null;
    }
}

module.exports = { KWinFocusWatcher };
