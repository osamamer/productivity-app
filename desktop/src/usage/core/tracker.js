/**
 * The screen-time state machine, kept pure so every rule is testable without a desktop.
 *
 * Events:
 *   { type: 'focus', appId, title, fullscreen }  the focused window changed (appId '' = none)
 *   { type: 'title', title, fullscreen }         the focused window's caption or fullscreen changed
 *   { type: 'idle', idleSince }                  no input since `idleSince`
 *   { type: 'active' }                           input again
 *   { type: 'locked' } / { type: 'unlocked' }
 *   { type: 'checkpoint' }                       cut the open segment so a crash loses little
 *   { type: 'stop' }                             tracking ends (quit, disabled, suspend)
 *
 * `reduce` returns the next state and the segment that was closed, if any. Idle backdates the end
 * of the open segment to the last input, because those minutes were not spent on the app.
 * A fullscreen window keeps counting while idle: watching a video needs no input.
 */
const INITIAL_STATE = Object.freeze({ focus: null, idle: false, locked: false, current: null });

function activityOf(state, recordTitles) {
    const { focus, idle, locked } = state;
    if (!focus || !focus.appId || locked) return null;
    if (idle && !focus.fullscreen) return null;
    return { appId: focus.appId, title: recordTitles && focus.title ? focus.title : null };
}

function sameActivity(a, b) {
    if (!a || !b) return a === b;
    return a.appId === b.appId && a.title === b.title;
}

function close(current, end) {
    if (!current) return null;
    const clampedEnd = Math.max(current.start, end);
    return clampedEnd > current.start ? { ...current, end: clampedEnd } : null;
}

function applyEvent(state, event) {
    switch (event.type) {
        case 'focus':
            return { ...state, focus: event.appId ? { appId: event.appId, title: event.title || '', fullscreen: Boolean(event.fullscreen) } : null };
        case 'title':
            return state.focus ? { ...state, focus: { ...state.focus, title: event.title || '', fullscreen: Boolean(event.fullscreen) } } : state;
        case 'idle':
            return { ...state, idle: true };
        case 'active':
            return { ...state, idle: false };
        case 'locked':
            return { ...state, locked: true };
        case 'unlocked':
            return { ...state, locked: false, idle: false };
        default:
            return state;
    }
}

function reduce(state, event, now, { recordTitles = true } = {}) {
    if (event.type === 'stop') {
        return { state: { ...INITIAL_STATE }, closed: close(state.current, now) };
    }
    if (event.type === 'checkpoint') {
        if (!state.current) return { state, closed: null };
        return { state: { ...state, current: { ...state.current, start: now } }, closed: close(state.current, now) };
    }
    const next = applyEvent(state, event);
    const before = state.current && { appId: state.current.appId, title: state.current.title };
    const after = activityOf(next, recordTitles);
    if (sameActivity(before, after)) return { state: { ...next, current: state.current }, closed: null };

    const end = event.type === 'idle' && Number.isFinite(event.idleSince) ? Math.min(now, event.idleSince) : now;
    return {
        state: { ...next, current: after ? { ...after, start: now } : null },
        closed: close(state.current, end),
    };
}

module.exports = { INITIAL_STATE, reduce };
