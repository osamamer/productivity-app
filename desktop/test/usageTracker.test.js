const test = require('node:test');
const assert = require('node:assert/strict');
const { INITIAL_STATE, reduce } = require('../src/usage/core/tracker');

/** Feeds `[time, event]` pairs through the reducer and collects the segments it closes. */
function run(steps, options) {
    let state = INITIAL_STATE;
    const closed = [];
    for (const [now, event] of steps) {
        const result = reduce(state, event, now, options);
        state = result.state;
        if (result.closed) closed.push(result.closed);
    }
    return { state, closed };
}

const focus = (appId, title = '', fullscreen = false) => ({ type: 'focus', appId, title, fullscreen });

test('switching apps closes the previous app at the moment of the switch', () => {
    const { closed, state } = run([
        [1000, focus('firefox', 'Docs')],
        [5000, focus('org.kde.konsole', 'zsh')],
    ]);
    assert.deepEqual(closed, [{ appId: 'firefox', title: 'Docs', start: 1000, end: 5000 }]);
    assert.deepEqual(state.current, { appId: 'org.kde.konsole', title: 'zsh', start: 5000 });
});

test('a title change starts a new segment, so the timeline can tell documents apart', () => {
    const { closed } = run([
        [0, focus('libreoffice-writer', 'thesis.odt')],
        [3000, { type: 'title', title: 'memes.odt' }],
    ]);
    assert.deepEqual(closed, [{ appId: 'libreoffice-writer', title: 'thesis.odt', start: 0, end: 3000 }]);
});

test('with titles off, title changes are invisible and nothing stores a title', () => {
    const { closed, state } = run([
        [0, focus('firefox', 'Private thing')],
        [3000, { type: 'title', title: 'Other private thing' }],
        [6000, focus('org.kde.dolphin', 'Home')],
    ], { recordTitles: false });
    assert.deepEqual(closed, [{ appId: 'firefox', title: null, start: 0, end: 6000 }]);
    assert.equal(state.current.title, null);
});

test('going idle backdates the end to the last input, because those minutes were not app time', () => {
    const { closed, state } = run([
        [0, focus('firefox')],
        [600_000, { type: 'idle', idleSince: 420_000 }],
    ]);
    assert.deepEqual(closed, [{ appId: 'firefox', title: null, start: 0, end: 420_000 }]);
    assert.equal(state.current, null);
});

test('input after idling resumes the focused app from that moment', () => {
    const { state } = run([
        [0, focus('firefox')],
        [600_000, { type: 'idle', idleSince: 420_000 }],
        [900_000, { type: 'active' }],
    ]);
    assert.deepEqual(state.current, { appId: 'firefox', title: null, start: 900_000 });
});

test('a fullscreen window keeps counting while idle: watching a video needs no input', () => {
    const { closed, state } = run([
        [0, focus('mpv', 'film.mkv', true)],
        [600_000, { type: 'idle', idleSince: 420_000 }],
    ]);
    assert.deepEqual(closed, []);
    assert.equal(state.current.appId, 'mpv');
});

test('leaving fullscreen while idle stops the clock', () => {
    const { closed } = run([
        [0, focus('mpv', 'film.mkv', true)],
        [600_000, { type: 'idle', idleSince: 420_000 }],
        [700_000, { type: 'title', title: 'film.mkv', fullscreen: false }],
    ]);
    assert.deepEqual(closed, [{ appId: 'mpv', title: 'film.mkv', start: 0, end: 700_000 }]);
});

test('locking the screen ends the segment and unlocking resumes it', () => {
    const { closed, state } = run([
        [0, focus('firefox')],
        [5000, { type: 'locked' }],
        [9000, { type: 'unlocked' }],
    ]);
    assert.deepEqual(closed, [{ appId: 'firefox', title: null, start: 0, end: 5000 }]);
    assert.deepEqual(state.current, { appId: 'firefox', title: null, start: 9000 });
});

test('no focused window (e.g. every window minimised) records nothing', () => {
    const { closed, state } = run([
        [0, focus('firefox')],
        [5000, focus('')],
    ]);
    assert.equal(closed.length, 1);
    assert.equal(state.current, null);
});

test('a checkpoint writes what has happened so far and keeps the app open', () => {
    const { closed, state } = run([
        [0, focus('firefox')],
        [60_000, { type: 'checkpoint' }],
    ]);
    assert.deepEqual(closed, [{ appId: 'firefox', title: null, start: 0, end: 60_000 }]);
    assert.deepEqual(state.current, { appId: 'firefox', title: null, start: 60_000 });
});

test('stopping closes the open segment and forgets the focus', () => {
    const { closed, state } = run([
        [0, focus('firefox')],
        [5000, { type: 'stop' }],
    ]);
    assert.equal(closed.length, 1);
    assert.deepEqual(state, INITIAL_STATE);
});

test('zero-length segments are never emitted', () => {
    const { closed } = run([
        [1000, focus('firefox')],
        [1000, focus('org.kde.dolphin')],
    ]);
    assert.deepEqual(closed, []);
});
