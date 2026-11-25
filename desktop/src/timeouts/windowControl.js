const fs = require('node:fs');
const path = require('node:path');
const dbus = require('dbus-next');
const { desktopKind } = require('../usage/core/desktop');
const { isShowing } = require('./core/windows');

const SERVICE = 'app.claritard.Windows';
const OBJECT_PATH = '/app/claritard/Windows';
const SCRIPT_NAME = 'claritard-windows';
const SCRIPT_SOURCE = path.join(__dirname, 'kwin', 'claritard-windows.js');
const ONE_SHOT_UNLOAD_MS = 2000;

class WindowsInterface extends dbus.interface.Interface {
    constructor(onWindows) {
        super(SERVICE);
        this.onWindows = onWindows;
    }

    Windows(json) {
        this.onWindows(json);
    }
}

WindowsInterface.configureMembers({ methods: { Windows: { inSignature: 's', outSignature: '' } } });

function minimizeScript(pids, appIds) {
    return `const pids = ${JSON.stringify(pids)};
const appIds = ${JSON.stringify(appIds)};
for (const window of workspace.windowList()) {
    if (!(window.normalWindow || window.dialog) || !window.minimizable) continue;
    if (pids.includes(window.pid) || appIds.includes(String(window.desktopFileName))) window.minimized = true;
}
`;
}

/**
 * Sees and minimizes other apps' windows on KDE Plasma through KWin scripts: a lasting one
 * reports every change in which windows exist and are minimized; a one-off one minimizes.
 * Elsewhere (GNOME, X11 desktops) it is unavailable: `snapshot` stays null and `minimize`
 * resolves false, so callers count all time and close instead.
 *
 * The scripts are copied out of the app bundle because KWin cannot read inside the asar archive.
 */
class WindowControl {
    constructor({ stateDir, onChange = () => {} }) {
        this.stateDir = stateDir;
        this.onChange = onChange;
        this.bus = null;
        this.snapshot = null;
        this.oneShots = 0;
    }

    get available() {
        return this.bus !== null;
    }

    async start(env = process.env) {
        if (desktopKind(env) !== 'kde' || this.bus) return;
        const bus = dbus.sessionBus();
        try {
            const owned = await bus.requestName(SERVICE, dbus.NameFlag.DO_NOT_QUEUE);
            if (owned !== dbus.RequestNameReply.PRIMARY_OWNER && owned !== dbus.RequestNameReply.ALREADY_OWNER) {
                throw new Error('Another program owns the Claritard window service.');
            }
            bus.export(OBJECT_PATH, new WindowsInterface(json => this.received(json)));
            this.bus = bus;
            await this.runScript(SCRIPT_NAME, fs.readFileSync(SCRIPT_SOURCE, 'utf8'));
        } catch (error) {
            console.error(`Window control is unavailable: ${error.message}`, error);
            this.bus = null;
            this.snapshot = null;
            bus.disconnect();
        }
    }

    received(json) {
        try {
            const windows = JSON.parse(json);
            if (!Array.isArray(windows)) return;
            this.snapshot = windows.map(window => ({
                pid: Number(window.pid) || 0,
                appId: String(window.appId ?? ''),
                minimized: Boolean(window.minimized),
            }));
            this.onChange();
        } catch (error) {
            console.error(`Could not read the window list from KWin: ${error.message}`, error);
        }
    }

    /** Minimizes the program's windows. Resolves false where windows cannot be minimized. */
    async minimize(target, processes) {
        if (!this.available) return false;
        const pids = processes.map(proc => proc.pid);
        const appIds = target.flatpak ? [target.flatpak] : [];
        const name = `claritard-minimize-${process.pid}-${this.oneShots += 1}`;
        try {
            await this.runScript(name, minimizeScript(pids, appIds));
            setTimeout(() => {
                void this.unloadScript(name).finally(() => fs.rmSync(this.scriptFile(name), { force: true }));
            }, ONE_SHOT_UNLOAD_MS).unref?.();
            return true;
        } catch (error) {
            console.error(`Could not minimize windows: ${error.message}`, error);
            return false;
        }
    }

    /** True when one of the program's windows is on screen; null when unknown. */
    isShowing(target, processes) {
        return isShowing(this.snapshot, target, processes);
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

    scriptFile(name) {
        return path.join(this.stateDir, `kwin-${name}.js`);
    }

    async runScript(name, source) {
        fs.mkdirSync(this.stateDir, { recursive: true });
        const file = this.scriptFile(name);
        fs.writeFileSync(file, source);
        // A script left behind by a crash would report twice, so replace it.
        await this.unloadScript(name);
        const id = await this.callScripting('loadScript', 'ss', [file, name]);
        if (id < 0) throw new Error(`KWin refused to load ${name}.`);
        await this.callScripting('start', '', []);
    }

    async unloadScript(name) {
        if (!this.bus) return;
        try {
            await this.callScripting('unloadScript', 's', [name]);
        } catch (error) {
            console.error(`Could not unload the KWin script ${name}: ${error.message}`, error);
        }
    }

    async stop() {
        if (!this.bus) return;
        await this.unloadScript(SCRIPT_NAME);
        this.bus.disconnect();
        this.bus = null;
        this.snapshot = null;
    }
}

module.exports = { WindowControl };
