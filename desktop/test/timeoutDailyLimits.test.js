const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { timeoutPaths } = require('../src/timeouts/core/paths');
const { appSettings, urlSettings, saveConfig, emptyConfig } = require('../src/timeouts/core/config');
const { readDailyUsage, addDailyUsage } = require('../src/timeouts/core/dailyUsage');
const { appUsageToday, entryProgram } = require('../src/timeouts/core/appDailyLimits');
const { grantBrowserRule, expireBrowser, readSession, urlSecondsToday, recordTabPresence, hasTimedBrowserTab } = require('../src/timeouts/core/browserSession');
const { DailyLimitMonitor } = require('../src/timeouts/dailyLimitMonitor');

const URL = 'https://youtube.com/';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function tempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-daily-'));
    return { root, paths: timeoutPaths({ HOME: path.join(root, 'home') }) };
}

/** A Firefox stand-in the session code accepts: not a script, so its process could be tracked. */
function fakeFirefox(paths) {
    const file = path.join(paths.home, 'Applications', 'firefox-developer-edition', 'firefox');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '\x7fELF');
}

function writeSession(paths, session) {
    fs.mkdirSync(path.dirname(paths.browserSessionFile), { recursive: true });
    fs.writeFileSync(paths.browserSessionFile, JSON.stringify(session));
}

const siteRule = { delaySeconds: 0, closeAfterSeconds: 3600, dailyLimitSeconds: 600, message: 'Breathe' };

// ---- Settings ----

test('a daily limit is optional and must fit in a day', () => {
    assert.equal(appSettings({ delaySeconds: 5 }).dailyLimitSeconds, 0);
    assert.equal(appSettings({ delaySeconds: 5, dailyLimitSeconds: 1800 }).dailyLimitSeconds, 1800);
    assert.equal(urlSettings({ delaySeconds: 5, closeAfterSeconds: 60, dailyLimitSeconds: 900 }).dailyLimitSeconds, 900);
    assert.throws(() => appSettings({ delaySeconds: 5, dailyLimitSeconds: 86401 }), /daily limit/);
    assert.throws(() => urlSettings({ delaySeconds: 5, closeAfterSeconds: 60, dailyLimitSeconds: -1 }), /daily limit/);
});

// ---- Daily usage ----

test('daily usage adds up within a day and starts again from zero the next day', () => {
    const { paths } = tempPaths();
    const noon = new Date(2026, 10, 20, 12).getTime();
    addDailyUsage(paths, 'apps', 'spotify', 30, noon);
    addDailyUsage(paths, 'apps', 'spotify', 15, noon);
    addDailyUsage(paths, 'urls', URL, 60, noon);
    assert.deepEqual(readDailyUsage(paths, noon), { date: '2026-11-20', apps: { spotify: 45 }, urls: { [URL]: 60 } });
    assert.deepEqual(readDailyUsage(paths, noon + 86_400_000), { date: '2026-11-21', apps: {}, urls: {} });
});

// ---- Firefox sites ----

test('a site whose daily limit is used up cannot be opened', () => {
    const { paths } = tempPaths();
    fakeFirefox(paths);
    addDailyUsage(paths, 'urls', URL, 600);
    assert.throws(() => grantBrowserRule(paths, URL, siteRule), error => error.code === 'daily-limit');
    assert.equal(readSession(paths), null);
});

test('opening a site with time left today ends the Firefox session when that time runs out', () => {
    const { paths } = tempPaths();
    fakeFirefox(paths);
    addDailyUsage(paths, 'urls', URL, 480);
    const before = Date.now() / 1000;
    const { session, created } = grantBrowserRule(paths, URL, siteRule);
    assert.equal(created, true);
    assert.ok(Math.abs(session.deadline - (before + 120)) < 2, 'the 2 minutes left today, not the hour of the timer');
});

test('opening a limited site in a running session brings the session deadline forward', () => {
    const { paths } = tempPaths();
    fakeFirefox(paths);
    const now = Date.now() / 1000;
    writeSession(paths, { id: 'abc', startedAt: now, deadline: now + 3600, name: 'x', rules: ['https://news.com/'], target: { executable: '/nonexistent' } });
    addDailyUsage(paths, 'urls', URL, 540);
    const { session, shortened } = grantBrowserRule(paths, URL, siteRule);
    assert.equal(shortened, true);
    assert.ok(Math.abs(session.deadline - (now + 60)) < 2);
    assert.deepEqual(session.rules, ['https://news.com/', URL]);
});

test('opening a site in a running session gives it no more than its own timer', () => {
    const { paths } = tempPaths();
    fakeFirefox(paths);
    const now = Date.now() / 1000;
    writeSession(paths, { id: 'abc', startedAt: now, deadline: now + 7200, name: 'x', rules: ['https://news.com/'], target: { executable: '/nonexistent' } });
    const { session, shortened } = grantBrowserRule(paths, URL, { ...siteRule, dailyLimitSeconds: 0, closeAfterSeconds: 900 });
    assert.equal(shortened, true);
    assert.ok(Math.abs(session.deadline - (now + 900)) < 2, 'the 15 minutes of its timer, not the two hours left in the session');
});

test('opening a site with a longer timer in a running session keeps the earlier deadline', () => {
    const { paths } = tempPaths();
    fakeFirefox(paths);
    const now = Date.now() / 1000;
    writeSession(paths, { id: 'abc', startedAt: now, deadline: now + 300, name: 'x', rules: ['https://news.com/'], target: { executable: '/nonexistent' } });
    const { session, shortened } = grantBrowserRule(paths, URL, { ...siteRule, dailyLimitSeconds: 0, closeAfterSeconds: 3600 });
    assert.equal(shortened, false);
    assert.ok(Math.abs(session.deadline - (now + 300)) < 2);
});

test('time in a Firefox session counts toward the site from when it was opened, and is kept when the session ends', async () => {
    const { paths } = tempPaths();
    const now = Date.now() / 1000;
    writeSession(paths, {
        id: 'abc', startedAt: now - 300, deadline: now - 1, name: 'x', rules: ['https://news.com/', URL],
        grants: { 'https://news.com/': now - 300, [URL]: now - 101 }, target: { executable: '/nonexistent' },
    });
    assert.equal(Math.round(urlSecondsToday(paths, URL)), 100);
    assert.equal(await expireBrowser(paths, 'abc'), true);
    assert.equal(readSession(paths), null);
    assert.equal(Math.round(readDailyUsage(paths).urls[URL]), 100);
    assert.equal(Math.round(urlSecondsToday(paths, URL)), 100);
});

// ---- Apps ----

function fakeLauncher(root, paths, dailyLimitSeconds) {
    const script = path.join(root, 'music-player');
    fs.writeFileSync(script, '#!/bin/sh\nwhile :; do sleep 0.2; done\n');
    fs.chmodSync(script, 0o755);
    const backup = path.join(root, 'music.desktop');
    fs.writeFileSync(backup, `[Desktop Entry]\nType=Application\nName=Music\nExec=${script}\n`);
    const entry = { name: 'Music', backup, delaySeconds: 0, closeAfterSeconds: 0, dailyLimitSeconds, autoOpen: true, message: '' };
    const config = { ...emptyConfig(), apps: { 'music.desktop': entry } };
    saveConfig(paths.configFile, config);
    return { script, entry, config };
}

function popupsStub() {
    return { shown: [], show(key) { this.shown.push(key); }, close() {} };
}

test('an app with its daily time used up is closed, however it was started', async () => {
    const { root, paths } = tempPaths();
    const { script, entry, config } = fakeLauncher(root, paths, 60);
    addDailyUsage(paths, 'apps', entryProgram(entry).identity, 60);
    assert.equal(appUsageToday(paths, entry).leftSeconds, 0);
    const child = spawn(script, [], { stdio: 'ignore' });
    const notifications = [];
    try {
        await sleep(200);
        const monitor = new DailyLimitMonitor({
            paths, loadConfig: () => config, popups: popupsStub(), notify: note => notifications.push(note), appearance: () => null, onChange: () => {},
        });
        await monitor.check();
        await sleep(200);
        assert.notEqual(child.exitCode ?? child.signalCode, null, 'the app was closed');
        assert.equal(notifications.at(-1).title, 'Music is done for today');
    } finally {
        child.kill('SIGKILL');
    }
});

test('a running app with a daily limit has its time counted and keeps Claritard busy', async () => {
    const { root, paths } = tempPaths();
    const { script, entry, config } = fakeLauncher(root, paths, 3600);
    const child = spawn(script, [], { stdio: 'ignore' });
    const popups = popupsStub();
    try {
        await sleep(200);
        const monitor = new DailyLimitMonitor({ paths, loadConfig: () => config, popups, notify: () => {}, appearance: () => null, onChange: () => {} });
        await monitor.check();
        assert.equal(monitor.busy, true);
        await sleep(1100);
        await monitor.check();
        const { usedSeconds } = appUsageToday(paths, entry);
        assert.ok(usedSeconds >= 1 && usedSeconds < 3, `counted ${usedSeconds} s`);
        assert.deepEqual(popups.shown, [], 'no "closes in" window while plenty of time is left');
        assert.equal(child.exitCode, null);
    } finally {
        child.kill('SIGKILL');
    }
});

test('closing timed Firefox tabs hides the countdown without changing the session deadline', t => {
    const { root, paths } = tempPaths();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fakeFirefox(paths);
    const { session } = grantBrowserRule(paths, URL, siteRule);
    const profileId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const secondProfile = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const report = (id, hasTimedTab) => recordTabPresence(paths, { sessionId: session.id, profileId: id, hasTimedTab });

    assert.equal(hasTimedBrowserTab(paths, session.id), true);
    report(profileId, false);
    assert.equal(hasTimedBrowserTab(paths, session.id), false);
    report(secondProfile, true);
    assert.equal(hasTimedBrowserTab(paths, session.id), true);
    report(secondProfile, false);
    assert.equal(hasTimedBrowserTab(paths, session.id), false);
    report(profileId, true);
    assert.equal(hasTimedBrowserTab(paths, session.id), true);
    assert.equal(hasTimedBrowserTab(paths, session.id, Date.now() + 21_000), false);
    assert.equal(readSession(paths).deadline, session.deadline);
});
