const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { isDebInstall, debInstallCommand, scheduleDebInstall } = require('../src/debInstall');

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

// Puts a fake pkexec on PATH that records its arguments instead of installing anything.
function fakePkexec(dir) {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'pkexec'), `#!/bin/sh\necho "$@" > "${dir}/pkexec-args"\n`, { mode: 0o755 });
    return { ...process.env, PATH: `${bin}:${process.env.PATH}` };
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
    assert.deepEqual(args.slice(3), ['42', "/tmp/it's.deb", '/opt/Claritard/claritard']);
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
