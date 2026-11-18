const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { isDebInstall, debInstallCommand, scheduleDebInstall, installMarkerPath, runningInstaller, deferLaunchUntilInstalled } = require('../src/debInstall');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-deb-'));
}

function waitFor(file, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const poll = () => {
            if (fs.existsSync(file)) return resolve(fs.readFileSync(file, 'utf8'));
            if (Date.now() > deadline) return reject(new Error(`${file} never appeared`));
            setTimeout(poll, 50);
        };
        poll();
    });
}

// Puts a fake pkexec on PATH that records its arguments instead of installing anything, and keeps
// the install marker inside the test's own folder.
function fakePkexec(dir, { seconds = 0, exitCode = 0 } = {}) {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'pkexec'), `#!/bin/sh\nsleep ${seconds}\necho "$@" > "${dir}/pkexec-args"\nexit ${exitCode}\n`, { mode: 0o755 });
    return { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_RUNTIME_DIR: dir };
}

// A stand-in for the Claritard binary that records the arguments it was started with.
function fakeApp(dir, name) {
    const marker = path.join(dir, `${name}-args`);
    const file = path.join(dir, `${name}.sh`);
    fs.writeFileSync(file, `#!/bin/sh\necho "$@" > "${marker}"\n`, { mode: 0o755 });
    return { file, marker };
}

function waitForGone(file, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const poll = () => {
            if (!fs.existsSync(file)) return resolve();
            if (Date.now() > deadline) return reject(new Error(`${file} was never removed`));
            setTimeout(poll, 50);
        };
        poll();
    });
}

test('a .deb build is recognised from the package-type file electron-builder writes', () => {
    const dir = tempDir();
    assert.equal(isDebInstall(dir), false);
    fs.writeFileSync(path.join(dir, 'package-type'), 'deb\n');
    assert.equal(isDebInstall(dir), true);
    fs.writeFileSync(path.join(dir, 'package-type'), 'AppImage');
    assert.equal(isDebInstall(dir), false);
});

test('the install command passes paths as arguments, never inside the script text', () => {
    const [command, args] = debInstallCommand({ appPid: 42, debPath: "/tmp/it's.deb", relaunchPath: '/opt/Claritard/claritard' });
    assert.equal(command, '/bin/sh');
    assert.deepEqual(args.slice(3, 6), ['42', "/tmp/it's.deb", '/opt/Claritard/claritard']);
    assert.ok(!args[1].includes("it's"));
});

test('the installer waits for the app to exit, then runs dpkg through pkexec and relaunches', async () => {
    const dir = tempDir();
    const env = fakePkexec(dir);
    const app = spawn('sleep', ['0.5']);
    const relaunchMarker = path.join(dir, 'relaunched');
    const relaunch = path.join(dir, 'relaunch.sh');
    fs.writeFileSync(relaunch, `#!/bin/sh\ntouch "${relaunchMarker}"\n`, { mode: 0o755 });

    scheduleDebInstall({ appPid: app.pid, debPath: '/tmp/update.deb', relaunchPath: relaunch, env });

    assert.equal(fs.existsSync(path.join(dir, 'pkexec-args')), false, 'must not install while the app runs');
    const args = await waitFor(path.join(dir, 'pkexec-args'));
    assert.equal(args.trim(), '--disable-internal-agent dpkg -i /tmp/update.deb');
    await waitFor(relaunchMarker);
});

test('choosing Later installs on quit without relaunching', async () => {
    const dir = tempDir();
    const env = fakePkexec(dir);
    const exited = spawn('true');
    await new Promise(resolve => exited.on('exit', resolve));

    scheduleDebInstall({ appPid: exited.pid, debPath: '/tmp/update.deb', relaunchPath: '', env });

    const args = await waitFor(path.join(dir, 'pkexec-args'));
    assert.equal(args.trim(), '--disable-internal-agent dpkg -i /tmp/update.deb');
});


test('the install marker names the running installer and is removed once dpkg has finished', async () => {
    const dir = tempDir();
    const env = fakePkexec(dir, { seconds: 0.5 });
    const markerPath = installMarkerPath(env);

    const installer = scheduleDebInstall({ appPid: 999999999, debPath: '/tmp/update.deb', relaunchPath: '', env });

    assert.equal(fs.readFileSync(markerPath, 'utf8'), String(installer.pid));
    assert.equal(runningInstaller(markerPath), installer.pid);
    await waitForGone(markerPath);
    assert.ok(fs.existsSync(path.join(dir, 'pkexec-args')), 'the marker goes only after dpkg ran');
    assert.equal(runningInstaller(markerPath), null);
});

test('a marker that points at a missing or unrelated process is ignored', () => {
    const dir = tempDir();
    const markerPath = path.join(dir, 'claritard-update.pid');
    assert.equal(runningInstaller(markerPath), null);
    fs.writeFileSync(markerPath, String(process.pid));
    assert.equal(runningInstaller(markerPath), null);
    fs.writeFileSync(markerPath, 'not a pid');
    assert.equal(runningInstaller(markerPath), null);
});

test('a launch with no install in progress goes ahead', () => {
    const dir = tempDir();
    const deferred = deferLaunchUntilInstalled({ argv: ['/opt/Claritard/claritard'], markerPath: path.join(dir, 'none.pid') });
    assert.equal(deferred, false);
});

test('a launch during an install is repeated with the same arguments once the install is done', async () => {
    const dir = tempDir();
    const env = fakePkexec(dir, { seconds: 0.5 });
    scheduleDebInstall({ appPid: 999999999, debPath: '/tmp/update.deb', relaunchPath: '', env });
    const app = fakeApp(dir, 'deferred');

    const deferred = deferLaunchUntilInstalled({ argv: [app.file, '--hidden'], markerPath: installMarkerPath(env), env });

    assert.equal(deferred, true);
    assert.equal(fs.existsSync(app.marker), false, 'must not start while the install runs');
    assert.equal((await waitFor(app.marker)).trim(), '--hidden');
    assert.ok(fs.existsSync(path.join(dir, 'pkexec-args')), 'starts only after dpkg ran');
});

function pendingDeb(dir) {
    const pending = path.join(dir, 'cache', 'pending');
    fs.mkdirSync(pending, { recursive: true });
    const deb = path.join(pending, 'claritard-desktop_1.2.9_amd64.deb');
    fs.writeFileSync(deb, 'new deb');
    fs.writeFileSync(path.join(pending, 'current.blockmap'), 'its blockmap');
    return deb;
}

test('after a successful install the .deb and its blockmap are kept for the next differential update', async () => {
    const dir = tempDir();
    const env = fakePkexec(dir);
    const deb = pendingDeb(dir);

    scheduleDebInstall({ appPid: 999999999, debPath: deb, relaunchPath: '', env });

    await waitForGone(installMarkerPath(env));
    const cache = path.join(dir, 'cache');
    assert.equal(fs.readFileSync(path.join(cache, 'installer.deb'), 'utf8'), 'new deb');
    assert.equal(fs.readFileSync(path.join(cache, 'installer.deb.blockmap'), 'utf8'), 'its blockmap');
});

test('a cancelled install keeps the previous .deb as the base for differential updates', async () => {
    const dir = tempDir();
    const env = fakePkexec(dir, { exitCode: 126 });
    const deb = pendingDeb(dir);
    fs.writeFileSync(path.join(dir, 'cache', 'installer.deb'), 'installed deb');

    scheduleDebInstall({ appPid: 999999999, debPath: deb, relaunchPath: '', env });

    await waitForGone(installMarkerPath(env));
    assert.equal(fs.readFileSync(path.join(dir, 'cache', 'installer.deb'), 'utf8'), 'installed deb');
    assert.ok(fs.existsSync(deb));
});
