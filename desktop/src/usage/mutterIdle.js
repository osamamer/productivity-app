const dbus = require('dbus-next');

const SERVICE = 'org.gnome.Mutter.IdleMonitor';
const OBJECT_PATH = '/org/gnome/Mutter/IdleMonitor/Core';
const MIN_CHECK_MS = 1000;

/**
 * Tells when there has been no keyboard or pointer input for `timeoutMs`, through Mutter's
 * IdleMonitor D-Bus API. GNOME does not offer the ext-idle-notify Wayland protocol.
 *
 * Mutter's idle watches never fire while any app holds an idle inhibitor, and media players and
 * browsers hold one while playing. `GetIdletime` and the user-active watch ignore inhibitors, so
 * idle is found by reading the idle time when the timeout could first be reached, and resumed
 * input by a user-active watch, which fires once and is added again each time the user goes idle.
 */
class MutterIdleMonitor {
    constructor({ timeoutMs, onIdle, onActive }) {
        this.timeoutMs = timeoutMs;
        this.onIdle = onIdle;
        this.onActive = onActive;
        this.bus = null;
        this.monitor = null;
        this.timer = null;
        this.idle = false;
        this.activeWatch = null;
    }

    async start() {
        this.bus = dbus.sessionBus();
        try {
            const object = await this.bus.getProxyObject(SERVICE, OBJECT_PATH);
            this.monitor = object.getInterface(SERVICE);
            this.monitor.on('WatchFired', id => this.watchFired(id));
            await this.check();
        } catch (error) {
            this.stop();
            throw new Error(`This desktop does not report input idle time (Mutter IdleMonitor): ${error.message}`);
        }
    }

    async check() {
        this.timer = null;
        const idleMs = Number(await this.monitor.GetIdletime());
        if (!this.bus) return;
        if (idleMs < this.timeoutMs) {
            this.schedule(this.timeoutMs - idleMs);
            return;
        }
        this.idle = true;
        this.onIdle(Date.now() - idleMs);
        this.activeWatch = await this.monitor.AddUserActiveWatch();
    }

    schedule(delayMs) {
        this.timer = setTimeout(() => {
            this.check().catch(error => {
                console.error(`Could not read the idle time: ${error.message}`, error);
                if (this.bus) this.schedule(this.timeoutMs);
            });
        }, Math.max(MIN_CHECK_MS, delayMs));
    }

    watchFired(id) {
        if (id !== this.activeWatch || !this.idle) return;
        this.activeWatch = null;
        this.idle = false;
        this.onActive();
        this.schedule(this.timeoutMs);
    }

    stop() {
        if (!this.bus) return;
        clearTimeout(this.timer);
        // Mutter drops a client's watches when its connection closes, so no RemoveWatch call.
        this.monitor?.removeAllListeners();
        this.bus.disconnect();
        this.bus = null;
        this.monitor = null;
        this.timer = null;
        this.idle = false;
        this.activeWatch = null;
    }
}

module.exports = { MutterIdleMonitor };
