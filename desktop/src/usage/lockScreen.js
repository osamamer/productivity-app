const KDE_SCREEN_SAVER = { service: 'org.freedesktop.ScreenSaver', path: '/ScreenSaver', iface: 'org.freedesktop.ScreenSaver' };
// GNOME's org.freedesktop.ScreenSaver only implements idle inhibition, without ActiveChanged.
const GNOME_SCREEN_SAVER = { service: 'org.gnome.ScreenSaver', path: '/org/gnome/ScreenSaver', iface: 'org.gnome.ScreenSaver' };

/**
 * Follows the lock screen through a ScreenSaver-style D-Bus interface (`ActiveChanged`,
 * `GetActive`). Failing to reach it is logged, not thrown: screen time still works, it just
 * keeps counting the focused app while locked until idle catches up.
 */
class LockScreenWatcher {
    constructor({ bus, address, onChange }) {
        this.bus = bus;
        this.address = address;
        this.onChange = onChange;
        this.screenSaver = null;
    }

    async start() {
        try {
            const { service, path, iface } = this.address;
            const object = await this.bus.getProxyObject(service, path);
            this.screenSaver = object.getInterface(iface);
            this.screenSaver.on('ActiveChanged', active => this.onChange(Boolean(active)));
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

    stop() {
        this.screenSaver?.removeAllListeners();
        this.screenSaver = null;
    }
}

module.exports = { LockScreenWatcher, KDE_SCREEN_SAVER, GNOME_SCREEN_SAVER };
