const { uint } = require('./core/waylandWire');
const { anyDisplayOn } = require('./core/displays');
const { WaylandConnection } = require('./waylandConnection');

// Opcodes from wayland.xml (wl_output) and KDE's dpms.xml (org_kde_kwin_dpms*).
const OUTPUT_RELEASE = 0;
const OUTPUT_NAME_EVENT = 4;
const DPMS_MANAGER_GET = 0;
const DPMS_RELEASE = 1;
const DPMS_SUPPORTED_EVENT = 0;
const DPMS_MODE_EVENT = 1;
const DPMS_DONE_EVENT = 2;

function readString(body) {
    const length = body.readUInt32LE(0);
    return body.subarray(4, 4 + length - 1).toString('utf8');
}

/**
 * Tells when no monitor is showing anything: every display is unplugged (KWin is left with its
 * placeholder output) or powered down through DPMS, e.g. "Turn off screen" or the power
 * settings. Reports only changes, starting from "on".
 *
 * Limitation: relies on KWin sending DPMS `done` for every output, as it does on creation.
 * KDE only (`org_kde_kwin_dpms_manager`); `start` rejects elsewhere. A monitor
 * switched off with its own button is invisible here unless it drops off the cable as unplugged,
 * which DisplayPort monitors usually do and some HDMI ones do not.
 */
class WaylandDisplayMonitor {
    constructor({ onChange, env = process.env }) {
        this.onChange = onChange;
        this.outputs = new Map();
        this.manager = null;
        this.on = true;
        this.connection = new WaylandConnection({
            env,
            onGlobal: global => this.globalAdded(global),
            onGlobalRemove: name => this.globalRemoved(name),
        });
    }

    async start() {
        await this.connection.open();
        const manager = this.connection.findGlobal('org_kde_kwin_dpms_manager');
        if (!manager) {
            this.stop();
            throw new Error('This desktop does not report whether screens are on.');
        }
        this.manager = this.connection.bind(manager, 'org_kde_kwin_dpms_manager', 1);
        for (const global of this.connection.globals.values()) this.globalAdded(global);
    }

    globalAdded(global) {
        if (this.manager === null || global.interface !== 'wl_output' || this.outputs.has(global.name)) return;
        const connection = this.connection;
        const output = { name: null, dpmsSupported: null, mode: null, described: false };
        // Version 4 is the first that sends the connector name, which tells the placeholder apart.
        const outputId = connection.bind(global, 'wl_output', Math.min(global.version, 4));
        const dpmsId = connection.allocate();
        connection.send(this.manager, DPMS_MANAGER_GET, [uint(dpmsId), uint(outputId)]);
        connection.listen(outputId, (opcode, body) => {
            if (opcode === OUTPUT_NAME_EVENT) output.name = readString(body);
        });
        connection.listen(dpmsId, (opcode, body) => {
            if (opcode === DPMS_SUPPORTED_EVENT) output.dpmsSupported = body.readUInt32LE(0) !== 0;
            else if (opcode === DPMS_MODE_EVENT) output.mode = body.readUInt32LE(0);
            else if (opcode === DPMS_DONE_EVENT) {
                output.described = true;
                this.report();
            }
        });
        this.outputs.set(global.name, { state: output, outputId, dpmsId, version: global.version });
        this.report();
    }

    globalRemoved(name) {
        const entry = this.outputs.get(name);
        if (!entry) return;
        this.outputs.delete(name);
        this.connection.forget(entry.outputId);
        this.connection.forget(entry.dpmsId);
        this.connection.send(entry.dpmsId, DPMS_RELEASE);
        if (entry.version >= 3) this.connection.send(entry.outputId, OUTPUT_RELEASE);
        this.report();
    }

    // Waits until every output has described itself, so a new placeholder never flickers as "on".
    report() {
        const states = [...this.outputs.values()].map(entry => entry.state);
        if (states.some(state => !state.described)) return;
        const on = anyDisplayOn(states);
        if (on === this.on) return;
        this.on = on;
        this.onChange(on);
    }

    stop() {
        this.connection.close();
    }
}

module.exports = { WaylandDisplayMonitor };
