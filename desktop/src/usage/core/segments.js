// Segments are `{ start, end, appId, title }` (epoch ms); tracked intervals are `{ start, end }`.

// Only touching pieces are continuous. Even a brief gap may be a display-off
// or tracking-off interval, so merging across it would turn unknown time into app time.
const MERGE_GAP_MS = 0;

function sameActivity(a, b) {
    return a.appId === b.appId && a.title === b.title;
}

/**
 * Joins touching pieces of the same activity, such as the pieces a periodic
 * checkpoint cuts a long stretch into. `same` decides which neighbours may be joined.
 */
function mergeIntervals(items, same = () => true, gapMs = MERGE_GAP_MS) {
    const sorted = [...items].sort((a, b) => a.start - b.start);
    const merged = [];
    for (const item of sorted) {
        const last = merged[merged.length - 1];
        if (last && same(last, item) && item.start - last.end <= gapMs) {
            last.end = Math.max(last.end, item.end);
        } else {
            merged.push({ ...item });
        }
    }
    return merged;
}

function mergeSegments(segments, gapMs = MERGE_GAP_MS) {
    return mergeIntervals(segments, sameActivity, gapMs);
}

/**
 * Drops brief visits: runs of one app (its segments back to back, whatever the titles) shorter
 * than `minMs`. Focus passes through windows for a moment when a switcher cycles, a window
 * closes or an app starts, and those moments are not time spent in the app.
 *
 * Limitation: a run cut by the edge of the asked range is judged by its visible part, so a
 * longer visit that only just reaches into the range can be left out.
 */
function dropBriefVisits(segments, minMs, gapMs = MERGE_GAP_MS) {
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const kept = [];
    let run = [];
    const flush = () => {
        if (run.length && run[run.length - 1].end - run[0].start >= minMs) kept.push(...run);
        run = [];
    };
    for (const segment of sorted) {
        const last = run[run.length - 1];
        if (last && (last.appId !== segment.appId || segment.start - last.end > gapMs)) flush();
        run.push(segment);
    }
    flush();
    return kept;
}

/** Cuts everything to [from, to) and drops what falls outside. */
function clipToRange(items, from, to) {
    return items
        .filter(item => item.end > from && item.start < to)
        .map(item => ({ ...item, start: Math.max(item.start, from), end: Math.min(item.end, to) }));
}

function nextLocalMidnight(ms) {
    const date = new Date(ms);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

/** Splits an interval at local midnights so each piece belongs to one day file. */
function splitAtLocalMidnight(item) {
    const pieces = [];
    let start = item.start;
    while (start < item.end) {
        const end = Math.min(item.end, nextLocalMidnight(start));
        pieces.push({ ...item, start, end });
        start = end;
    }
    return pieces;
}

/** The local calendar date of an instant, as `YYYY-MM-DD`. */
function dayKey(ms) {
    const date = new Date(ms);
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Every local date that [from, to) touches, oldest first. */
function dayKeysBetween(from, to) {
    const keys = [];
    for (let start = from; start < to; start = nextLocalMidnight(start)) keys.push(dayKey(start));
    return keys;
}

/**
 * Per local date, milliseconds in each app, oldest date first. Segments that cross midnight
 * count toward both days. Dates with no app time are left out.
 */
function dailyAppTotals(segments) {
    const days = new Map();
    for (const piece of segments.flatMap(splitAtLocalMidnight)) {
        const key = dayKey(piece.start);
        const apps = days.get(key) ?? {};
        apps[piece.appId] = (apps[piece.appId] ?? 0) + piece.end - piece.start;
        days.set(key, apps);
    }
    return [...days.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, apps]) => ({ date, apps, totalMs: Object.values(apps).reduce((total, ms) => total + ms, 0) }));
}

module.exports = { mergeSegments, mergeIntervals, dropBriefVisits, clipToRange, splitAtLocalMidnight, dayKey, dayKeysBetween, dailyAppTotals };
