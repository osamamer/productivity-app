const net = require('node:net');
const path = require('node:path');
const { uint, string, encodeMessage, decodeMessages, decodeGlobal } = require('./core/waylandWire');

// Object ids and opcodes from wayland.xml.
const DISPLAY_ID = 1;
const DISPLAY_SYNC = 0;
const DISPLAY_GET_REGISTRY = 1;
const DISPLAY_ERROR_EVENT = 0;
const REGISTRY_BIND = 0;
const REGISTRY_GLOBAL_EVENT = 0;
const REGISTRY_GLOBAL_REMOVE_EVENT = 1;
const CALLBACK_DONE_EVENT = 0;

/**
 * A bare Wayland client connection: the registry, binding globals and routing events to the
 * object they belong to. `open` resolves once the first batch of globals has arrived.
 *
 * Limitation: object ids are never reused, which is fine for the handful of objects a monitor
 * creates over a session.
 */
class WaylandConnection {
    constructor({ env = process.env, onGlobal = () => {}, onGlobalRemove = () => {}, onClose = () => {} } = {}) {
        this.env = env;
        this.onGlobal = onGlobal;
        this.onGlobalRemove = onGlobalRemove;
        this.onClose = onClose;
        this.socket = null;
        this.nextId = 2;
        this.buffer = Buffer.alloc(0);
        this.listeners = new Map();
        this.globals = new Map();
        this.registry = null;
    }

    socketPath() {
        const display = this.env.WAYLAND_DISPLAY;
        if (!display) throw new Error('Not a Wayland session.');
        return path.isAbsolute(display) ? display : path.join(this.env.XDG_RUNTIME_DIR || '', display);
    }

    allocate() {
        return this.nextId++;
    }

    send(objectId, opcode, args = []) {
        this.socket?.write(encodeMessage(objectId, opcode, args));
    }

    /** Routes events for `objectId` to `handler(opcode, body)`. */
    listen(objectId, handler) {
        this.listeners.set(objectId, handler);
    }

    forget(objectId) {
        this.listeners.delete(objectId);
    }

    bind(global, interfaceName, version) {
        const id = this.allocate();
        this.send(this.registry, REGISTRY_BIND, [uint(global.name), string(interfaceName), uint(version), uint(id)]);
        return id;
    }

    open() {
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                if (error) {
                    this.close();
                    reject(error);
                } else {
                    resolve();
                }
            };
            this.socket = net.connect(this.socketPath());
            this.socket.on('error', error => finish(error));
            this.socket.on('close', () => {
                finish(new Error('The Wayland connection closed.'));
                this.onClose();
            });
            this.registry = this.allocate();
            const sync = this.allocate();
            this.listen(this.registry, (opcode, body) => this.registryEvent(opcode, body));
            this.listen(sync, opcode => {
                if (opcode === CALLBACK_DONE_EVENT) finish(null);
            });
            this.listen(DISPLAY_ID, (opcode, body) => {
                if (opcode === DISPLAY_ERROR_EVENT) console.error(`Wayland protocol error: ${body.toString('utf8')}`);
            });
            this.socket.on('connect', () => {
                this.send(DISPLAY_ID, DISPLAY_GET_REGISTRY, [uint(this.registry)]);
                this.send(DISPLAY_ID, DISPLAY_SYNC, [uint(sync)]);
            });
            this.socket.on('data', chunk => this.receive(chunk));
        });
    }

    receive(chunk) {
        const { messages, rest } = decodeMessages(Buffer.concat([this.buffer, chunk]));
        this.buffer = rest;
        for (const { objectId, opcode, body } of messages) {
            try {
                this.listeners.get(objectId)?.(opcode, body);
            } catch (error) {
                console.error(`Could not handle a Wayland event: ${error.message}`, error);
            }
        }
    }

    registryEvent(opcode, body) {
        if (opcode === REGISTRY_GLOBAL_EVENT) {
            const global = decodeGlobal(body);
            this.globals.set(global.name, global);
            this.onGlobal(global);
        } else if (opcode === REGISTRY_GLOBAL_REMOVE_EVENT) {
            const name = body.readUInt32LE(0);
            this.globals.delete(name);
            this.onGlobalRemove(name);
        }
    }

    /** The first advertised global with this interface name, if any. */
    findGlobal(interfaceName) {
        return [...this.globals.values()].find(global => global.interface === interfaceName);
    }

    close() {
        this.socket?.removeAllListeners();
        this.socket?.on('error', () => {});
        this.socket?.destroy();
        this.socket = null;
        this.listeners.clear();
    }
}

module.exports = { WaylandConnection };
