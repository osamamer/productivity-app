const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { timeoutPaths } = require('../src/timeouts/core/paths');
const { runningProcesses } = require('../src/timeouts/core/processes');
const { targetIdentity, saveAppSession, readAppSession, liveAppSession } = require('../src/timeouts/core/appSessions');
const { AppSessionMonitor } = require('../src/timeouts/sessionMonitors');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** A private script standing in for an app, so only processes this test starts match its target. */
function fakeApp() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-app-sessions-'));
    const script = path.join(root, 'music-player');
    fs.writeFileSync(script, '#!/bin/sh\nwhile :; do sleep 0.2; done\n');
    fs.chmodSync(script, 0o755);
    const paths = timeoutPaths({ HOME: path.join(root, 'home') });
    const target = { executable: script };
    const children = [];
    const open = () => {
        const child = spawn(script, [], { stdio: 'ignore' });
        children.push(child);
        return child;
    };
    const cleanup = () => children.forEach(child => child.kill('SIGKILL'));
    return { paths, target, open, cleanup };
}

async function waitFor(condition, timeoutMs = 5000) {
    const until = Date.now() + timeoutMs;
    while (!condition()) {
        if (Date.now() > until) throw new Error('Timed out waiting');
        await sleep(50);
    }
}

function exited(child) {
    return new Promise(resolve => {
        if (child.exitCode !== null || child.signalCode !== null) resolve();
        else child.once('exit', resolve);
    });
}

function monitor(paths, popups) {
    return new AppSessionMonitor({
        paths,
        command: ['claritard'],
        popups,
        notify: () => {},
        appearance: () => null,
        onChange: () => {},
        backstop: { schedule: async () => true, cancel() {} },
    });
}

test('a timed app keeps its time left after it is closed, so reopening it needs no countdown', () => {
    const { paths, target, cleanup } = fakeApp();
    try {
        const identity = targetIdentity(target);
        saveAppSession(paths, { id: 'a', identity, target, processes: [], deadline: Date.now() + 60_000 });
        saveAppSession(paths, { id: 'b', identity: 'another-app', target, processes: [], deadline: Date.now() + 60_000 });

        assert.equal(liveAppSession(paths, identity).id, 'a');
        assert.equal(liveAppSession(paths, identity, Date.now() + 61_000), null, 'not once the time has run out');
        assert.equal(liveAppSession(paths, 'never-opened'), null);
    } finally {
        cleanup();
    }
});

test('closing a timed app and reopening it continues the same open, and the reopened app closes at the deadline', async () => {
    const { paths, target, open, cleanup } = fakeApp();
    const shown = new Set();
    const popups = { show: id => shown.add(id), close: id => shown.delete(id) };
    try {
        const first = open();
        await waitFor(() => runningProcesses(target).length === 1);
        const session = {
            id: 'player-1',
            identity: targetIdentity(target),
            name: 'Music Player',
            target,
            processes: runningProcesses(target),
            totalSeconds: 3,
            deadline: Date.now() + 3000,
        };
        saveAppSession(paths, session);
        const watching = monitor(paths, popups).watch(session);
        await waitFor(() => shown.has('player-1'));

        // Closed: the "closes in" window goes, the session stays.
        first.kill('SIGKILL');
        await waitFor(() => !shown.has('player-1'));
        assert.ok(readAppSession(paths, 'player-1'));

        // Reopened before the deadline: the same session follows the new process.
        const second = open();
        await waitFor(() => shown.has('player-1'));
        assert.deepEqual(readAppSession(paths, 'player-1').processes.map(proc => proc.pid), [second.pid]);

        await watching;
        await exited(second);
        assert.equal(readAppSession(paths, 'player-1'), null, 'the session ends at its deadline');
    } finally {
        cleanup();
    }
});

test('a timed app that stays closed until its deadline just ends its session', async () => {
    const { paths, target, open, cleanup } = fakeApp();
    const popups = { show: () => {}, close: () => {} };
    try {
        const child = open();
        await waitFor(() => runningProcesses(target).length === 1);
        const session = {
            id: 'player-2', identity: targetIdentity(target), name: 'Music Player', target,
            processes: runningProcesses(target), totalSeconds: 1, deadline: Date.now() + 1000,
        };
        saveAppSession(paths, session);
        const watching = monitor(paths, popups).watch(session);
        child.kill('SIGKILL');
        await watching;
        assert.equal(readAppSession(paths, 'player-2'), null);
    } finally {
        cleanup();
    }
});
