const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appTarget } = require('../src/timeouts/core/appTarget');
const { profileArgument } = require('../src/timeouts/core/profileArgument');
const { runningProcesses } = require('../src/timeouts/core/processes');

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
