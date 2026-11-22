const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appTarget } = require('../src/timeouts/core/appTarget');
const { profileArgument } = require('../src/timeouts/core/profileArgument');
const { processStamp, runningProcesses } = require('../src/timeouts/core/processes');

const launcher = exec => `[Desktop Entry]\nType=Application\nName=Nuclear\nExec=${exec}\n`;

test('a profile argument is read in both spellings and ignored after --', () => {
    assert.equal(profileArgument(['--profile', 'calm']), 'calm');
    assert.equal(profileArgument(['--profile=calm', '%U']), 'calm');
    assert.equal(profileArgument(['--', '--profile', 'calm']), null);
    assert.equal(profileArgument(['file.mp3']), null);
});

test('a launcher for a light profile targets that profile of the binary', () => {
    assert.deepEqual(appTarget(launcher('/bin/true --profile calm %U')), { executable: fs.realpathSync('/bin/true'), profile: 'calm' });
    assert.deepEqual(appTarget(launcher('/bin/true %U')), { executable: fs.realpathSync('/bin/true') });
});

test('processes of one profile are never counted as another profile or the default app', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-profiles-'));
    const script = path.join(dir, 'player.js');
    fs.writeFileSync(script, 'setTimeout(() => {}, 30000);\n');
    const calm = spawn(process.execPath, [script, '--profile', 'calm'], { stdio: 'ignore' });
    const full = spawn(process.execPath, [script], { stdio: 'ignore' });
    t.after(() => {
        calm.kill();
        full.kill();
        fs.rmSync(dir, { recursive: true, force: true });
    });
    await new Promise(resolve => setTimeout(resolve, 200));

    const pids = target => runningProcesses(target).map(proc => proc.pid);
    const node = fs.realpathSync(process.execPath);
    assert.deepEqual(pids({ executable: node, script, profile: 'calm' }), [calm.pid]);
    assert.deepEqual(pids({ executable: node, script }), [full.pid]);
    assert.deepEqual(pids({ executable: node, script, profile: 'focus' }), []);
});

test('an ended Firefox timer closes Firefox started with any --profile', async t => {
    const { expireBrowser } = require('../src/timeouts/core/browserSession');
    const { timeoutPaths } = require('../src/timeouts/core/paths');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-firefox-'));
    const script = path.join(dir, 'firefox.js');
    fs.writeFileSync(script, 'setInterval(() => {}, 1000);\n');
    const firefox = spawn(process.execPath, [script, '--profile', path.join(dir, 'timed-profile')], { stdio: 'ignore' });
    t.after(() => {
        firefox.kill('SIGKILL');
        fs.rmSync(dir, { recursive: true, force: true });
    });
    await new Promise(resolve => setTimeout(resolve, 200));

    const paths = timeoutPaths({ HOME: dir, XDG_DATA_HOME: path.join(dir, 'data') });
    fs.mkdirSync(path.dirname(paths.browserSessionFile), { recursive: true });
    const target = { executable: fs.realpathSync(process.execPath), script };
    fs.writeFileSync(paths.browserSessionFile, JSON.stringify({ id: 'ended', deadline: 1, rules: [], target }));

    assert.equal(await expireBrowser(paths, 'ended'), true);
    assert.equal(processStamp(firefox.pid), null, 'Firefox is still running');
    assert.equal(fs.existsSync(paths.browserSessionFile), false);
});

test('the Firefox popup follows a timed tab while expiry keeps the original deadline', async t => {
    const { BrowserSessionMonitor } = require('../src/timeouts/sessionMonitors');
    const { recordTabPresence, readSession } = require('../src/timeouts/core/browserSession');
    const { timeoutPaths } = require('../src/timeouts/core/paths');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-timed-tab-'));
    const script = path.join(dir, 'firefox.js');
    fs.writeFileSync(script, 'setInterval(() => {}, 1000);');
    const firefox = spawn(process.execPath, [script], { stdio: 'ignore' });
    t.after(() => {
        firefox.kill('SIGKILL');
        fs.rmSync(dir, { recursive: true, force: true });
    });
    await new Promise(resolve => setTimeout(resolve, 200));

    const paths = timeoutPaths({ HOME: dir, XDG_DATA_HOME: path.join(dir, 'data') });
    fs.mkdirSync(path.dirname(paths.browserSessionFile), { recursive: true });
    const deadline = Date.now() / 1000 + 60;
    fs.writeFileSync(paths.browserSessionFile, JSON.stringify({
        id: 'timed', deadline, rules: [], target: { executable: fs.realpathSync(process.execPath), script },
    }));
    const actions = [];
    const monitor = new BrowserSessionMonitor({
        paths,
        popups: { show: (_, options) => actions.push(options.deadline), close: () => actions.push('hidden') },
        notify() {}, appearance() {}, onChange() {},
    });
    const report = hasTimedTab => recordTabPresence(paths, {
        sessionId: 'timed', profileId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', hasTimedTab,
    });

    report(true);
    monitor.check();
    report(false);
    monitor.check();
    report(true);
    monitor.check();

    assert.deepEqual(actions, [deadline * 1000, 'hidden', deadline * 1000]);
    assert.equal(readSession(paths).deadline, deadline);
});
