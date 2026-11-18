const { uint } = require('./core/waylandWire');
const { WaylandConnection } = require('./waylandConnection');

// Opcodes from ext-idle-notify-v1.xml.
// get_input_idle_notification (v2) ignores idle inhibitors. Media players hold an inhibitor
// while playing, which would otherwise keep a music-in-the-background evening "active".
const NOTIFIER_GET_INPUT_IDLE_NOTIFICATION = 2;
const NOTIFICATION_IDLED_EVENT = 0;
const NOTIFICATION_RESUMED_EVENT = 1;

/**
 * Tells when there has been no keyboard or pointer input for `timeoutMs`, through the Wayland
 * `ext_idle_notifier_v1` protocol. Electron's `powerMonitor.getSystemIdleTime()` always reports
 * 0 on KDE Wayland, and KDE does not implement the ScreenSaver `GetSessionIdleTime` call.
 *
 * Limitation: needs a compositor with ext-idle-notify v2 (KWin 6, recent wlroots; not Mutter,
 * which `MutterIdleMonitor` covers).
 * `start` rejects when it is missing, and screen time then only stops at the lock screen.
 */
class WaylandIdleMonitor {
    constructor({ timeoutMs, onIdle, onActive, env = process.env }) {
        this.timeoutMs = timeoutMs;
        this.onIdle = onIdle;
        this.onActive = onActive;
        this.connection = new WaylandConnection({ env });
    }

    async start() {
        await this.connection.open();
        try {
            this.subscribe();
        } catch (error) {
            this.stop();
            throw error;
        }
    }

    subscribe() {
        const connection = this.connection;
        const seat = connection.findGlobal('wl_seat');
        const notifier = connection.findGlobal('ext_idle_notifier_v1');
        if (!seat || !notifier || notifier.version < 2) throw new Error('This desktop does not report input idle time (ext-idle-notify v2).');
        const seatId = connection.bind(seat, 'wl_seat', 1);
        const notifierId = connection.bind(notifier, 'ext_idle_notifier_v1', 2);
        const notificationId = connection.allocate();
        connection.send(notifierId, NOTIFIER_GET_INPUT_IDLE_NOTIFICATION, [uint(notificationId), uint(this.timeoutMs), uint(seatId)]);
        connection.listen(notificationId, opcode => {
            if (opcode === NOTIFICATION_IDLED_EVENT) this.onIdle(Date.now() - this.timeoutMs);
            else if (opcode === NOTIFICATION_RESUMED_EVENT) this.onActive();
        });
    }

    stop() {
        this.connection.close();
    }
}

module.exports = { WaylandIdleMonitor };
