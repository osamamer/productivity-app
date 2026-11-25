const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { timeoutPaths } = require('../src/timeouts/core/paths');
const { appSettings, countdownDisplay, saveConfig, emptyConfig } = require('../src/timeouts/core/config');
const { programWindows, isShowing, countsNow } = require('../src/timeouts/core/windows');
const { addDailyUsage } = require('../src/timeouts/core/dailyUsage');
const { appUsageToday, entryProgram, limitedApps } = require('../src/timeouts/core/appDailyLimits');
const { runningProcesses } = require('../src/timeouts/core/processes');
const { targetIdentity, saveAppSession, readAppSession } = require('../src/timeouts/core/appSessions');
const { CountdownDisplay } = require('../src/timeouts/countdownDisplay');
const { DailyLimitMonitor } = require('../src/timeouts/dailyLimitMonitor');
const { AppSessionMonitor } = require('../src/timeouts/sessionMonitors');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(condition, timeoutMs = 5000) {
    const until = Date.now() + timeoutMs;
    while (!condition()) {
        if (Date.now() > until) throw new Error('Timed out waiting');
        await sleep(50);
    }
}

/** A private script standing in for an app, with a launcher whose rule the test chooses. */
function fakeApp(rule) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-windows-'));
    const paths = timeoutPaths({ HOME: path.join(root, 'home') });
    const script = path.join(root, 'music-player');
    fs.writeFileSync(script, '#!/bin/sh\nwhile :; do sleep 0.2; done\n');
    fs.chmodSync(script, 0o755);
    const backup = path.join(root, 'music.desktop');
    fs.writeFileSync(backup, `[Desktop Entry]\nType=Application\nName=Music\nExec=${script}\n`);
    const entry = {
        name: 'Music', backup, delaySeconds: 0, closeAfterSeconds: 0, dailyLimitSeconds: 0, autoOpen: true, message: '', ...rule,
    };
    const config = { ...emptyConfig(), apps: { 'music.desktop': entry } };
    saveConfig(paths.configFile, config);
    const children = [];
    const open = () => {
        const child = spawn(script, [], { stdio: 'ignore' });
        children.push(child);
        return child;
    };
    const cleanup = () => {
        children.forEach(child => child.kill('SIGKILL'));
        fs.rmSync(root, { recursive: true, force: true });
    };
    return { paths, target: { executable: script }, entry, config, open, cleanup };
}

/** Window control as KDE would give it: `showing` is what the app's windows look like now. */
function fakeWindows(showing) {
    return {
        showing,
        minimized: 0,
        isShowing() {
            return this.showing;
        },
        async minimize() {
            this.minimized += 1;
            this.showing = false;
            return true;
        },
    };
}

const popups = { show() {}, close() {} };
// Tests must not leave systemd timers behind.
const noBackstop = { schedule: async () => true, cancel() {} };

function isRunning(child) {
    return child.exitCode === null && child.signalCode === null;
}

// ---- Settings ----

test('apps count minimized time and close when time is up unless told otherwise', () => {
    const defaults = appSettings({ delaySeconds: 5 });
    assert.equal(defaults.countMinimized, true);
    assert.equal(defaults.onTimeUp, 'close');

    const custom = appSettings({ delaySeconds: 5, countMinimized: false, onTimeUp: 'minimize' });
    assert.equal(custom.countMinimized, false);
    assert.equal(custom.onTimeUp, 'minimize');

    assert.throws(() => appSettings({ delaySeconds: 5, onTimeUp: 'explode' }), /closed or minimized/);
});

test('time left is shown in a window or as notifications, nothing else', () => {
    assert.equal(emptyConfig().countdownDisplay, 'window');
    assert.equal(countdownDisplay('notification'), 'notification');
    assert.throws(() => countdownDisplay('banner'), /window or as notifications/);
});

test('launchers of one program share the most demanding rule', () => {
    const { entry, config, cleanup } = fakeApp({ dailyLimitSeconds: 600, countMinimized: false, onTimeUp: 'minimize' });
    try {
        config.apps['music-alias.desktop'] = { ...entry, dailyLimitSeconds: 1200, countMinimized: true, onTimeUp: 'close' };
        const [app] = limitedApps(config);
        assert.equal(app.limitSeconds, 600);
        assert.equal(app.countMinimized, true, 'one alias counting minimized time is enough');
        assert.equal(app.onTimeUp, 'close', 'one alias closing is enough');
    } finally {
        cleanup();
    }
});

// ---- Which windows are on screen ----

test('an app is showing while one of its windows is not minimized', () => {
    const target = { executable: '/usr/bin/player' };
    const processes = [{ pid: 10 }, { pid: 11 }];
    const snapshot = [
        { pid: 10, appId: 'player', minimized: true },
        { pid: 11, appId: 'player', minimized: false },
        { pid: 99, appId: 'editor', minimized: false },
    ];
    assert.deepEqual(programWindows(snapshot, target, processes).map(window => window.pid), [10, 11]);
    assert.equal(isShowing(snapshot, target, processes), true);
    assert.equal(isShowing(snapshot.slice(0, 1), target, processes), false, 'only minimized windows');
    assert.equal(isShowing([], target, processes), false, 'no windows: hidden to the tray');
    assert.equal(isShowing(null, target, processes), null, 'unknown without window control');
});

test('a Flatpak window matches by its app ID, whatever process drew it', () => {
    const target = { flatpak: 'com.spotify.Client' };
    const snapshot = [{ pid: 4242, appId: 'com.spotify.Client', minimized: false }];
    assert.equal(isShowing(snapshot, target, [{ pid: 1, instance: '7' }]), true);
});

test('minimized time is left out only when the rule says so and the app is known to be out of sight', () => {
    assert.equal(countsNow({ countMinimized: true }, false), true);
    assert.equal(countsNow({ countMinimized: false }, false), false);
    assert.equal(countsNow({ countMinimized: false }, true), true);
    assert.equal(countsNow({ countMinimized: false }, null), true, 'unknown windows count, as before');
});

// ---- Countdown display ----

test('notification countdowns announce each deadline once, and again when it moves', () => {
    const notes = [];
    const shownWindows = [];
    let mode = 'notification';
    const display = new CountdownDisplay({
        popups: { show: key => shownWindows.push(key), close() {}, closeAll() {} },
        notify: note => notes.push(note),
        mode: () => mode,
    });
    const deadline = Date.now() + 25 * 60_000;
    display.show('a', { name: 'Music', deadline });
    display.show('a', { name: 'Music', deadline: deadline + 5000 });
    assert.equal(notes.length, 1);
    assert.match(notes[0].title, /^Music closes at /);
    assert.equal(notes[0].body, '25 minutes left.');

    display.show('a', { name: 'Music', deadline: deadline + 10 * 60_000, action: 'minimize' });
    assert.equal(notes.length, 2, 'a pause moved the deadline');
    assert.match(notes[1].title, /^Music minimizes at /);
    assert.deepEqual(shownWindows, []);

    mode = 'window';
    display.show('a', { name: 'Music', deadline });
    assert.deepEqual(shownWindows, ['a']);
});

// ---- Daily limits ----

test('a daily limit that leaves out minimized time does not count while the app is minimized', async () => {
    const { paths, entry, config, open, cleanup } = fakeApp({ dailyLimitSeconds: 3600, countMinimized: false });
    try {
        open();
        await sleep(200);
        const windows = fakeWindows(false);
        const monitor = new DailyLimitMonitor({ paths, loadConfig: () => config, popups, notify() {}, appearance: () => null, onChange() {}, windows });
        await monitor.check();
        await sleep(1100);
        await monitor.check();
        assert.equal(appUsageToday(paths, entry).usedSeconds, 0);

        windows.showing = true;
        await sleep(1100);
        await monitor.check();
        assert.ok(appUsageToday(paths, entry).usedSeconds >= 1, 'counts again once restored');
    } finally {
        cleanup();
    }
});

test('an app whose rule minimizes stays running when its daily time is used up, and is minimized again when restored', async () => {
    const { paths, entry, config, open, cleanup } = fakeApp({ dailyLimitSeconds: 60, onTimeUp: 'minimize' });
    try {
        addDailyUsage(paths, 'apps', entryProgram(entry).identity, 60);
        const child = open();
        await sleep(200);
        const windows = fakeWindows(true);
        const notes = [];
        const monitor = new DailyLimitMonitor({
            paths, loadConfig: () => config, popups, notify: note => notes.push(note), appearance: () => null, onChange() {}, windows,
        });
        await monitor.check();
        assert.equal(windows.minimized, 1);
        assert.match(notes.at(-1).body, /stays minimized until tomorrow/);

        await monitor.check();
        assert.equal(windows.minimized, 1, 'left alone while it stays minimized');
        windows.showing = true;
        await monitor.check();
        assert.equal(windows.minimized, 2);
        assert.ok(isRunning(child));
    } finally {
        cleanup();
    }
});

// ---- Auto-close ----

function monitor(paths, windows) {
    return new AppSessionMonitor({
        paths, command: ['claritard'], popups, notify() {}, appearance: () => null, onChange() {}, windows, backstop: noBackstop,
    });
}

async function timedSession(paths, target, seconds, rule) {
    await waitFor(() => runningProcesses(target).length === 1);
    const session = {
        id: `player-${Date.now()}`, identity: targetIdentity(target), name: 'Music', target,
        processes: runningProcesses(target), totalSeconds: seconds, deadline: Date.now() + seconds * 1000, ...rule,
    };
    saveAppSession(paths, session);
    return session;
}

test('an auto-close that leaves out minimized time moves its deadline while the app is minimized', async () => {
    const { paths, target, open, cleanup } = fakeApp({});
    try {
        open();
        const session = await timedSession(paths, target, 60, { countMinimized: false });
        const deadline = session.deadline;
        const windows = fakeWindows(false);
        const timing = monitor(paths, windows);
        const watching = timing.watch(session);
        await sleep(2200);
        assert.ok(session.deadline - deadline >= 1500, `moved ${session.deadline - deadline} ms`);
        assert.ok(readAppSession(paths, session.id), 'still timed');
        session.deadline = Date.now();
        windows.showing = true;
        await watching;
    } finally {
        cleanup();
    }
});

test('an app whose rule minimizes is minimized at its deadline, kept minimized, and freed by a new open', async () => {
    const { paths, target, open, cleanup } = fakeApp({});
    try {
        const child = open();
        const session = await timedSession(paths, target, 1, { onTimeUp: 'minimize' });
        const windows = fakeWindows(true);
        const timing = monitor(paths, windows);
        await timing.watch(session);
        assert.equal(windows.minimized, 1);
        assert.ok(isRunning(child));
        assert.equal(readAppSession(paths, session.id), null, 'the open is over');
        assert.equal(timing.busy, true, 'held while it runs');

        windows.showing = true;
        await waitFor(() => windows.minimized === 2);

        timing.release(session.identity);
        assert.equal(timing.busy, false);
    } finally {
        cleanup();
    }
});

test('without window control an app whose rule minimizes is closed instead', async () => {
    const { paths, target, open, cleanup } = fakeApp({});
    try {
        const child = open();
        const session = await timedSession(paths, target, 1, { onTimeUp: 'minimize' });
        await monitor(paths, undefined).watch(session);
        await waitFor(() => !isRunning(child), 8000);
    } finally {
        cleanup();
    }
});
