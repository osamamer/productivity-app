// Segments are `{ start, end, appId, title }` (epoch ms); tracked intervals are `{ start, end }`.

const MERGE_GAP_MS = 2000;

function sameActivity(a, b) {
    return a.appId === b.appId && a.title === b.title;
}

/**
 * Joins touching or nearly touching pieces of the same activity, such as the pieces a periodic
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

module.exports = { mergeSegments, mergeIntervals, clipToRange, splitAtLocalMidnight, dayKey, dayKeysBetween };
