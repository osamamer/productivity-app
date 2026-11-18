const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { playingPids, isPlayingFor } = require('../src/usage/core/audio');
const { AudioWatcher } = require('../src/usage/audioWatcher');

const stream = (pid, corked) => ({ corked, properties: { 'application.process.id': String(pid) } });

// --- Reading the stream list

test('only streams that are not corked count as playing; a paused player corks its stream', () => {
    const json = JSON.stringify([stream(359801, true), stream(251202, false)]);
    assert.deepEqual([...playingPids(json)], [251202]);
});

test('streams without a process id are ignored', () => {
    const json = JSON.stringify([{ corked: false, properties: {} }]);
    assert.deepEqual([...playingPids(json)], []);
});

// --- Matching a stream to the focused window

test("a stream from the window's own process matches", () => {
    assert.equal(isPlayingFor(359801, new Set([359801]), () => null), true);
});

test('a stream from a child process matches, as with a browser audio service', () => {
    const parents = { 900: 800, 800: 700, 700: 1 };
    assert.equal(isPlayingFor(700, new Set([900]), pid => parents[pid] ?? null), true);
});

test("another app's music does not make the focused window audible", () => {
    const parents = { 900: 1 };
    assert.equal(isPlayingFor(700, new Set([900]), pid => parents[pid] ?? null), false);
    assert.equal(isPlayingFor(0, new Set([900]), () => null), false);
});

// --- The watcher against a fake pactl

function fakePactl(t, streamsFile) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-pactl-'));
    const script = path.join(dir, 'pactl');
    fs.writeFileSync(script, `#!/bin/sh
if [ "$1" = subscribe ]; then
  while true; do
    if [ -f "${streamsFile}.event" ]; then rm "${streamsFile}.event"; echo "Event 'change' on sink-input #7"; fi
    sleep 0.05
  done
fi
cat "${streamsFile}"
`, { mode: 0o755 });
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return script;
}

const waitFor = async condition => {
    for (let i = 0; i < 60 && !condition(); i++) await new Promise(resolve => setTimeout(resolve, 50));
};

test('the watcher reports playing pids at start and again when a stream changes', async t => {
    const streamsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-streams-')), 'streams.json');
    t.after(() => fs.rmSync(path.dirname(streamsFile), { recursive: true, force: true }));
    fs.writeFileSync(streamsFile, JSON.stringify([stream(42, false)]));
    const reports = [];
    const watcher = new AudioWatcher({ pactl: fakePactl(t, streamsFile), onChange: pids => reports.push(pids && [...pids]) });
    t.after(() => watcher.stop());

    await watcher.start();
    assert.deepEqual(reports, [[42]]);

    fs.writeFileSync(streamsFile, JSON.stringify([stream(42, true)]));
    fs.writeFileSync(`${streamsFile}.event`, '');
    await waitFor(() => reports.length > 1);
    assert.deepEqual(reports, [[42], []]);
});

test('without pactl the watcher cannot start', async () => {
    const watcher = new AudioWatcher({ pactl: '/nonexistent/pactl', onChange: () => {} });
    await assert.rejects(watcher.start());
});
