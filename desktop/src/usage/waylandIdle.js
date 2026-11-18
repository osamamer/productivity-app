const net = require('node:net');
const path = require('node:path');
const { uint, string, encodeMessage, decodeMessages, decodeGlobal } = require('./core/waylandWire');

// Object ids and opcodes from wayland.xml and ext-idle-notify-v1.xml.
const DISPLAY_ID = 1;
const DISPLAY_SYNC = 0;
const DISPLAY_GET_REGISTRY = 1;
const DISPLAY_ERROR_EVENT = 0;
const REGISTRY_BIND = 0;
const REGISTRY_GLOBAL_EVENT = 0;
const CALLBACK_DONE_EVENT = 0;
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
 * Limitation: needs a compositor with ext-idle-notify v2 (KWin 6, recent wlroots and Mutter).
 * `start` rejects when it is missing, and screen time then only stops at the lock screen.
 */
class WaylandIdleMonitor {
    constructor({ timeoutMs, onIdle, onActive, env = process.env }) {
        this.timeoutMs = timeoutMs;
        this.onIdle = onIdle;
        this.onActive = onActive;
        this.env = env;
        this.socket = null;
        this.nextId = 2;
        this.buffer = Buffer.alloc(0);
    }

    socketPath() {
        const display = this.env.WAYLAND_DISPLAY;
        if (!display) throw new Error('Not a Wayland session.');
        return path.isAbsolute(display) ? display : path.join(this.env.XDG_RUNTIME_DIR || '', display);
    }

    allocate() {
        return this.nextId++;
    }

    send(objectId, opcode, args) {
        this.socket.write(encodeMessage(objectId, opcode, args));
    }

    start() {
        return new Promise((resolve, reject) => {
            const globals = new Map();
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                if (error) {
                    this.stop();
                    reject(error);
                } else {
                    resolve();
                }
            };
            this.socket = net.connect(this.socketPath());
            this.socket.on('error', error => finish(error));
            this.socket.on('close', () => finish(new Error('The Wayland connection closed.')));

            const registry = this.allocate();
            const sync = this.allocate();
            let notification = null;
            this.socket.on('connect', () => {
                this.send(DISPLAY_ID, DISPLAY_GET_REGISTRY, [uint(registry)]);
                this.send(DISPLAY_ID, DISPLAY_SYNC, [uint(sync)]);
            });
            this.socket.on('data', chunk => {
                const { messages, rest } = decodeMessages(Buffer.concat([this.buffer, chunk]));
                this.buffer = rest;
                for (const { objectId, opcode, body } of messages) {
                    if (objectId === registry && opcode === REGISTRY_GLOBAL_EVENT) {
                        const global = decodeGlobal(body);
                        if (!globals.has(global.interface)) globals.set(global.interface, global);
                    } else if (objectId === sync && opcode === CALLBACK_DONE_EVENT) {
                        try {
                            notification = this.subscribe(registry, globals);
                            finish(null);
                        } catch (error) {
                            finish(error);
                        }
                    } else if (objectId === notification && opcode === NOTIFICATION_IDLED_EVENT) {
                        this.onIdle(Date.now() - this.timeoutMs);
                    } else if (objectId === notification && opcode === NOTIFICATION_RESUMED_EVENT) {
                        this.onActive();
                    } else if (objectId === DISPLAY_ID && opcode === DISPLAY_ERROR_EVENT) {
                        console.error(`Wayland idle monitor protocol error: ${body.toString('utf8')}`);
                    }
                }
            });
        });
    }

    subscribe(registry, globals) {
        const seat = globals.get('wl_seat');
        const notifier = globals.get('ext_idle_notifier_v1');
        if (!seat || !notifier || notifier.version < 2) throw new Error('This desktop does not report input idle time (ext-idle-notify v2).');
        const seatId = this.allocate();
        const notifierId = this.allocate();
        const notificationId = this.allocate();
        this.send(registry, REGISTRY_BIND, [uint(seat.name), string('wl_seat'), uint(1), uint(seatId)]);
        this.send(registry, REGISTRY_BIND, [uint(notifier.name), string('ext_idle_notifier_v1'), uint(2), uint(notifierId)]);
        this.send(notifierId, NOTIFIER_GET_INPUT_IDLE_NOTIFICATION, [uint(notificationId), uint(this.timeoutMs), uint(seatId)]);
        return notificationId;
    }

    stop() {
        this.socket?.removeAllListeners();
        this.socket?.on('error', () => {});
        this.socket?.destroy();
        this.socket = null;
    }
}

module.exports = { WaylandIdleMonitor };
