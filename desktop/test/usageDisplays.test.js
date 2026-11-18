const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { uint, string, encodeMessage, decodeMessages } = require('../src/usage/core/waylandWire');
const { anyDisplayOn } = require('../src/usage/core/displays');
const { WaylandDisplayMonitor } = require('../src/usage/waylandDisplays');

const ON = 0;
const OFF = 3;

// --- Which outputs count as a screen someone could be looking at

test('a connected monitor with DPMS on counts as on', () => {
    assert.equal(anyDisplayOn([{ name: 'DP-1', dpmsSupported: true, mode: ON }]), true);
});

test('every monitor powered down through DPMS counts as off', () => {
    assert.equal(anyDisplayOn([
        { name: 'DP-1', dpmsSupported: true, mode: OFF },
        { name: 'HDMI-A-1', dpmsSupported: true, mode: OFF },
    ]), false);
});

test('one monitor still on is enough', () => {
    assert.equal(anyDisplayOn([
        { name: 'DP-1', dpmsSupported: true, mode: OFF },
        { name: 'HDMI-A-1', dpmsSupported: true, mode: ON },
    ]), true);
});

test("KWin's placeholder output, left when every monitor is unplugged, is not a screen", () => {
    assert.equal(anyDisplayOn([{ name: 'Placeholder-1', dpmsSupported: false, mode: null }]), false);
    assert.equal(anyDisplayOn([]), false);
});

test('an output not yet described, or unable to report DPMS, counts as on so no real time is lost', () => {
    assert.equal(anyDisplayOn([{ name: null, dpmsSupported: null, mode: null }]), true);
    assert.equal(anyDisplayOn([{ name: 'eDP-1', dpmsSupported: false, mode: OFF }]), true);
});

// --- The monitor against a fake compositor socket

/**
 * Just enough of KWin to drive WaylandDisplayMonitor: advertises the given globals, answers
 * the initial sync, hands out DPMS objects, and lets the test push events afterwards.
 */
async function fakeCompositor(t, outputs) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-wl-'));
    const socketPath = path.join(dir, 'wayland-test');
    const state = { client: null, registry: null, dpmsFor: new Map(), outputIdFor: new Map(), released: [] };
    const send = (id, opcode, args = []) => state.client.write(encodeMessage(id, opcode, args));
    const global = (name, iface, version) => send(state.registry, 0, [uint(name), string(iface), uint(version)]);
    let buffer = Buffer.alloc(0);
    const server = net.createServer(client => {
        state.client = client;
        client.on('data', chunk => {
            const { messages, rest } = decodeMessages(Buffer.concat([buffer, chunk]));
            buffer = rest;
            for (const { objectId, opcode, body } of messages) handle(objectId, opcode, body);
        });
    });
    const handle = (objectId, opcode, body) => {
        if (objectId === 1 && opcode === 1) {
            state.registry = body.readUInt32LE(0);
            global(1, 'org_kde_kwin_dpms_manager', 1);
            for (const output of outputs) global(output.global, 'wl_output', 4);
        } else if (objectId === 1 && opcode === 0) {
            send(body.readUInt32LE(0), 0, [uint(0)]);
        } else if (objectId === state.registry && opcode === 0) {
            const name = body.readUInt32LE(0);
            const newId = body.readUInt32LE(body.length - 4);
            if (name !== 1) state.outputIdFor.set(newId, outputs.find(output => output.global === name));
        } else if (opcode === 0 && body.length === 8 && state.outputIdFor.has(body.readUInt32LE(4))) {
            const output = state.outputIdFor.get(body.readUInt32LE(4));
            const dpmsId = body.readUInt32LE(0);
            state.dpmsFor.set(output.global, dpmsId);
            send(body.readUInt32LE(4), 4, [string(output.name)]);
            send(dpmsId, 0, [uint(output.supported ? 1 : 0)]);
            send(dpmsId, 1, [uint(output.mode)]);
            send(dpmsId, 2);
        } else if (opcode === 1 && [...state.dpmsFor.values()].includes(objectId)) {
            state.released.push(objectId);
        }
    };
    await new Promise(resolve => server.listen(socketPath, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });
    return {
        env: { WAYLAND_DISPLAY: socketPath },
        setMode: (globalName, mode) => {
            const dpmsId = state.dpmsFor.get(globalName);
            send(dpmsId, 1, [uint(mode)]);
            send(dpmsId, 2);
        },
        unplug: globalName => send(state.registry, 1, [uint(globalName)]),
        plugIn: output => {
            outputs.push(output);
            global(output.global, 'wl_output', 4);
        },
        state,
    };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

async function startMonitor(t, compositor) {
    const changes = [];
    const monitor = new WaylandDisplayMonitor({ env: compositor.env, onChange: on => changes.push(on) });
    await monitor.start();
    t.after(() => monitor.stop());
    await settle();
    return changes;
}

test('the monitor stays quiet while a screen is on and reports when the last one powers down', async t => {
    const compositor = await fakeCompositor(t, [
        { global: 10, name: 'DP-1', supported: true, mode: ON },
        { global: 11, name: 'HDMI-A-1', supported: true, mode: ON },
    ]);
    const changes = await startMonitor(t, compositor);
    assert.deepEqual(changes, []);

    compositor.setMode(10, OFF);
    await settle();
    assert.deepEqual(changes, []);

    compositor.setMode(11, OFF);
    await settle();
    assert.deepEqual(changes, [false]);

    compositor.setMode(10, ON);
    await settle();
    assert.deepEqual(changes, [false, true]);
});

test('unplugging the only monitor reports off, and plugging one in reports on', async t => {
    const compositor = await fakeCompositor(t, [{ global: 10, name: 'DP-1', supported: true, mode: ON }]);
    const changes = await startMonitor(t, compositor);

    compositor.unplug(10);
    compositor.plugIn({ global: 12, name: 'Placeholder-1', supported: false, mode: ON });
    await settle();
    assert.deepEqual(changes, [false]);
    assert.equal(compositor.state.released.length, 1);

    compositor.plugIn({ global: 13, name: 'DP-1', supported: true, mode: ON });
    await settle();
    assert.deepEqual(changes, [false, true]);
});

test('a desktop without the KDE DPMS protocol makes start fail with a reason', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-wl-'));
    const socketPath = path.join(dir, 'wayland-test');
    const server = net.createServer(client => client.on('data', chunk => {
        const { messages } = decodeMessages(chunk);
        for (const { objectId, opcode, body } of messages) {
            if (objectId === 1 && opcode === 0) client.write(encodeMessage(body.readUInt32LE(0), 0, [uint(0)]));
        }
    }));
    await new Promise(resolve => server.listen(socketPath, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });
    const monitor = new WaylandDisplayMonitor({ env: { WAYLAND_DISPLAY: socketPath }, onChange: () => {} });
    await assert.rejects(monitor.start(), /whether screens are on/);
});
