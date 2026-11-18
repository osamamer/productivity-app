const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { UsageStore } = require('../src/usage/core/store');
const { mergeSegments, splitAtLocalMidnight, dayKey } = require('../src/usage/core/segments');
const { autostartEntry, setAutostart, isAutostartEnabled } = require('../src/usage/core/autostart');
const { readUsageSettings, writeUsageSettings } = require('../src/usage/core/settings');

function temporaryDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-usage-'));
}

const local = (day, hours, minutes = 0) => new Date(2026, 10, day, hours, minutes).getTime();

test('checkpoint pieces of one activity are merged back into one segment', () => {
    const merged = mergeSegments([
        { start: 0, end: 60_000, appId: 'firefox', title: 'A' },
        { start: 60_000, end: 120_000, appId: 'firefox', title: 'A' },
        { start: 120_500, end: 130_000, appId: 'firefox', title: 'B' },
    ]);
    assert.deepEqual(merged, [
        { start: 0, end: 120_000, appId: 'firefox', title: 'A' },
        { start: 120_500, end: 130_000, appId: 'firefox', title: 'B' },
    ]);
});

test('a segment across midnight is split so each day file holds its own part', () => {
    const pieces = splitAtLocalMidnight({ start: local(17, 23, 30), end: local(18, 0, 15), appId: 'firefox', title: null });
    assert.deepEqual(pieces.map(piece => dayKey(piece.start)), ['2026-11-17', '2026-11-18']);
    assert.equal(pieces[0].end, local(18, 0));
});

test('segments and tracked spans are read back merged and clipped to the range', () => {
    const store = new UsageStore(temporaryDir());
    store.appendSegment({ start: local(18, 9), end: local(18, 10), appId: 'firefox', title: 'Docs' });
    store.appendSegment({ start: local(18, 10), end: local(18, 11), appId: 'firefox', title: 'Docs' });
    store.appendTracked({ start: local(18, 9), end: local(18, 10) });
    store.appendTracked({ start: local(18, 10), end: local(18, 12) });

    const { segments, tracked } = store.readRange(local(18, 9, 30), local(18, 23));
    assert.deepEqual(segments, [{ start: local(18, 9, 30), end: local(18, 11), appId: 'firefox', title: 'Docs' }]);
    assert.deepEqual(tracked, [{ start: local(18, 9, 30), end: local(18, 12) }]);
});

test('a range spanning two days reads both day files', () => {
    const store = new UsageStore(temporaryDir());
    store.appendSegment({ start: local(17, 23), end: local(18, 1), appId: 'mpv', title: null });
    const { segments } = store.readRange(local(17, 0), local(19, 0));
    assert.deepEqual(segments, [{ start: local(17, 23), end: local(18, 1), appId: 'mpv', title: null }]);
});

test('a torn or corrupt line is skipped instead of losing the whole day', () => {
    const dir = temporaryDir();
    const store = new UsageStore(dir);
    store.appendSegment({ start: local(18, 9), end: local(18, 10), appId: 'firefox', title: null });
    fs.appendFileSync(path.join(dir, '2026-11-18.jsonl'), '{"k":"s","s":1\n');
    assert.equal(store.readRange(local(18, 0), local(19, 0)).segments.length, 1);
});

test('settings default to off: nothing is recorded until the user opts in', () => {
    assert.deepEqual(readUsageSettings(path.join(temporaryDir(), 'usage.json')), { enabled: false, recordTitles: true });
});

test('saved settings are read back', () => {
    const file = path.join(temporaryDir(), 'nested', 'usage.json');
    writeUsageSettings(file, { enabled: true, recordTitles: false });
    assert.deepEqual(readUsageSettings(file), { enabled: true, recordTitles: false });
});

test('the autostart entry starts Claritard hidden and quotes paths with spaces', () => {
    const entry = autostartEntry(['/opt/My Apps/claritard']);
    assert.match(entry, /^Exec="\/opt\/My Apps\/claritard" --hidden$/m);
    assert.match(entry, /^Type=Application$/m);
});

test('start at login is the presence of the autostart file', () => {
    const file = path.join(temporaryDir(), 'autostart', 'claritard.desktop');
    setAutostart(file, true, ['/usr/bin/claritard']);
    assert.equal(isAutostartEnabled(file), true);
    setAutostart(file, false, ['/usr/bin/claritard']);
    assert.equal(isAutostartEnabled(file), false);
});
