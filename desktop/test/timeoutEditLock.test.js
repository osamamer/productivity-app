const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EditLock, WAIT_MS, UNLOCKED_MS } = require('../src/timeouts/core/editLock');

function lockWithClock() {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-lock-')), 'password.json');
    const clock = { now: 1_000_000 };
    return { lock: new EditLock({ file, now: () => clock.now }), clock, file };
}

test('nothing can change until a password is set; setting the first one unlocks at once', () => {
    const { lock } = lockWithClock();
    assert.throws(() => lock.assertUnlocked(), /Set a Boundaries password/);
    assert.throws(() => lock.unlock('anything'), /Set a password first/);
    assert.throws(() => lock.setPassword('short'), /at least 8/);
    lock.setPassword('correct horse');
    assert.doesNotThrow(() => lock.assertUnlocked());
});

test('the password is stored hashed, never as typed', () => {
    const { lock, file } = lockWithClock();
    lock.setPassword('correct horse');
    assert.ok(!fs.readFileSync(file, 'utf8').includes('correct horse'));
});

test('the right password unlocks editing only after a ten second wait', () => {
    const { lock, clock } = lockWithClock();
    lock.setPassword('correct horse');
    lock.lock();
    assert.throws(() => lock.unlock('wrong horse'), /Incorrect password/);
    const status = lock.unlock('correct horse');
    assert.equal(status.readyAt, clock.now + WAIT_MS);
    assert.throws(() => lock.assertUnlocked(), /Wait for the countdown/);
    clock.now += WAIT_MS - 1;
    assert.throws(() => lock.assertUnlocked(), /Wait for the countdown/);
    clock.now += 1;
    assert.doesNotThrow(() => lock.assertUnlocked());
});

test('an unlock lapses after fifteen minutes, or when the page locks it again', () => {
    const { lock, clock } = lockWithClock();
    lock.setPassword('correct horse');
    clock.now += UNLOCKED_MS;
    assert.throws(() => lock.assertUnlocked(), /Enter your password/);
    lock.unlock('correct horse');
    clock.now += WAIT_MS;
    lock.lock();
    assert.throws(() => lock.assertUnlocked(), /Enter your password/);
});

test('changing the password needs editing to be unlocked first', () => {
    const { lock, clock } = lockWithClock();
    lock.setPassword('correct horse');
    lock.lock();
    assert.throws(() => lock.setPassword('battery staple'), /Unlock editing/);
    lock.unlock('correct horse');
    clock.now += WAIT_MS;
    lock.setPassword('battery staple');
    lock.lock();
    assert.throws(() => lock.unlock('correct horse'), /Incorrect/);
    assert.doesNotThrow(() => lock.unlock('battery staple'));
});
