const test = require('node:test');
const assert = require('node:assert/strict');
const { describeCheck, describeDownload } = require('../src/autoUpdate');

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

test('download progress shows percent and speed in the title bar', () => {
    const shown = describeDownload({ version: '1.2.9', percent: 12.7, transferred: 36_000_000, total: 284_000_000, bytesPerSecond: 210_000 });
    assert.equal(shown.label, 'Update 12% · 210 KB/s');
    assert.equal(shown.fraction, 0.127);
});

test('download progress details the size and the time left', () => {
    const shown = describeDownload({ version: '1.2.9', percent: 50, transferred: 142_000_000, total: 284_000_000, bytesPerSecond: 20_000 });
    assert.equal(shown.detail, 'Downloading Claritard 1.2.9: 142 MB of 284 MB, about 1 h 58 min left');
});

test('a download that has not reported progress yet says it is starting', () => {
    const shown = describeDownload({ version: '1.2.9' });
    assert.equal(shown.label, 'Update 0%');
    assert.equal(shown.detail, 'Starting to download Claritard 1.2.9…');
});
