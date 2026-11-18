const test = require('node:test');
const assert = require('node:assert/strict');
const { describeCheck } = require('../src/autoUpdate');

test('a check that finds nothing newer says the app is up to date', () => {
    const outcome = describeCheck({ result: { isUpdateAvailable: false, updateInfo: { version: '1.2.5' } }, currentVersion: '1.2.5' });
    assert.equal(outcome.message, 'Claritard is up to date.');
    assert.match(outcome.detail, /1\.2\.5/);
});

test('a check that finds a newer release names its version', () => {
    const outcome = describeCheck({ result: { isUpdateAvailable: true, updateInfo: { version: '1.2.9' } }, currentVersion: '1.2.5' });
    assert.equal(outcome.message, 'Claritard 1.2.9 is available.');
});

test('a check with no result (updater busy or skipped) is treated as up to date', () => {
    assert.equal(describeCheck({ result: null, currentVersion: '1.2.5' }).message, 'Claritard is up to date.');
});

test('a failed check reports the error as a warning', () => {
    const outcome = describeCheck({ error: new Error('offline'), currentVersion: '1.2.5' });
    assert.equal(outcome.type, 'warning');
    assert.equal(outcome.detail, 'offline');
});
