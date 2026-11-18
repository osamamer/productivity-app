const fs = require('node:fs');
const path = require('node:path');
const dbus = require('dbus-next');

const SERVICE = 'app.claritard.Usage';
const OBJECT_PATH = '/app/claritard/Usage';
const SCRIPT_NAME = 'claritard-usage';
const SCRIPT_SOURCE = path.join(__dirname, 'kwin', 'claritard-usage.js');

class UsageInterface extends dbus.interface.Interface {
    constructor(handlers) {
        super(SERVICE);
        this.handlers = handlers;
    }

    Focus(appId, title, fullscreen) {
        this.handlers.onFocus({ appId, title, fullscreen });
    }

    Title(appId, title, fullscreen) {
        this.handlers.onTitle({ appId, title, fullscreen });
    }
}

UsageInterface.configureMembers({
    methods: {
        Focus: { inSignature: 'ssb', outSignature: '' },
        Title: { inSignature: 'ssb', outSignature: '' },
    },
});

/**
 * Follows the focused window on KDE Plasma 6 through a small KWin script that calls back into
 * a D-Bus service this process owns, and follows the lock screen through the ScreenSaver
 * interface.
 *
 * Limitation: KDE only. Other desktops make `start` reject with a message for the user.
 * The script is copied out of the app bundle because KWin cannot read inside the asar archive.
 */
class KWinFocusWatcher {
    constructor({ scriptFile, onFocus, onTitle, onLockChange }) {
        this.scriptFile = scriptFile;
        this.handlers = { onFocus, onTitle };
        this.onLockChange = onLockChange;
        this.bus = null;
        this.screenSaver = null;
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
        if (!/kde/i.test(process.env.XDG_CURRENT_DESKTOP || '')) {
            throw new Error('Screen time currently works on KDE Plasma only.');
        }
        this.bus = dbus.sessionBus();
        const owned = await this.bus.requestName(SERVICE, dbus.NameFlag.DO_NOT_QUEUE);
        if (owned !== dbus.RequestNameReply.PRIMARY_OWNER && owned !== dbus.RequestNameReply.ALREADY_OWNER) {
            throw new Error('Another program is already tracking screen time for Claritard.');
        }
        this.bus.export(OBJECT_PATH, new UsageInterface(this.handlers));

        fs.mkdirSync(path.dirname(this.scriptFile), { recursive: true });
        fs.copyFileSync(SCRIPT_SOURCE, this.scriptFile);
        // A script left behind by a crash would report twice, so replace it.
        await this.callScripting('unloadScript', 's', [SCRIPT_NAME]);
        const id = await this.callScripting('loadScript', 'ss', [this.scriptFile, SCRIPT_NAME]);
        if (id < 0) throw new Error('KWin refused to load the screen-time script.');
        await this.callScripting('start', '', []);
        await this.watchLockScreen();
    }

    async watchLockScreen() {
        try {
            const object = await this.bus.getProxyObject('org.freedesktop.ScreenSaver', '/ScreenSaver');
            this.screenSaver = object.getInterface('org.freedesktop.ScreenSaver');
            this.screenSaver.on('ActiveChanged', active => this.onLockChange(Boolean(active)));
        } catch (error) {
            console.error(`Screen time cannot see the lock screen: ${error.message}`, error);
        }
    }

    async isLocked() {
        try {
            return Boolean(await this.screenSaver?.GetActive());
        } catch (error) {
            console.error(`Could not ask whether the screen is locked: ${error.message}`, error);
            return false;
        }
    }

    async stop() {
        if (!this.bus) return;
        try {
            await this.callScripting('unloadScript', 's', [SCRIPT_NAME]);
        } catch (error) {
            console.error(`Could not unload the screen-time KWin script: ${error.message}`, error);
        }
        this.screenSaver?.removeAllListeners();
        this.bus.disconnect();
        this.bus = null;
    }
}

module.exports = { KWinFocusWatcher };
