// Pure layout for the day timeline: where each block sits in the day window and what it means.
// Times are epoch milliseconds so the rules are easy to test.

export interface TimeInterval {
    start: number;
    end: number;
}

export interface ScreenSegmentInput extends TimeInterval {
    appId: string;
    title: string | null;
}

export interface PlannedInput extends TimeInterval {
    id: string;
    // 'timer' is time actually spent, from an activity timer.
    kind: 'event' | 'focus' | 'timer';
    title: string;
    // Set for a chunk: its activity's name and colour.
    activityName?: string;
    color?: string;
}

export interface AppTime {
    appId: string;
    name: string;
    color: string;
    ms: number;
}

interface Placed {
    leftPct: number;
    widthPct: number;
}

export type ScreenBlock = Placed & TimeInterval & (
    | { kind: 'app'; appId: string; name: string; color: string; titles: string[] }
    // Short stretches in several apps, too small to draw one by one.
    | { kind: 'switching'; apps: AppTime[] }
    // Tracking was running but no app was in use: idle, locked or away.
    | { kind: 'away' }
    // Claritard was closed or tracking was off, so nothing is known.
    | { kind: 'untracked' }
);

// `columns` is how many rows its group of overlapping blocks needs, so a block that overlaps
// nothing can use the full width in the vertical day view.
export type PlannedBlock = Placed & PlannedInput & { row: number; columns: number };

// Bursts of app hopping read better as one block than as a barcode. Anything under ten minutes is
// about 3px wide on a day strip, so runs that short are grouped whenever they follow each other.
const SHORT_MS = 10 * 60_000;
const JOIN_GAP_MS = 5_000;
const MAX_TITLES = 3;

// Mid-tone hues, far enough apart to tell neighbours apart, that read on light and dark
// backgrounds. No red: app time is not an alarm.
const APP_COLORS = ['#5b8def', '#e0864a', '#4fb38a', '#b46fd6', '#d4a72c', '#4ab3c4', '#d96a8c', '#8a9a3c'];

/** The same app always gets the same colour, on every day. */
export function appColor(appId: string): string {
    let hash = 0;
    for (const character of appId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return APP_COLORS[hash % APP_COLORS.length];
}

function place(start: number, end: number, windowStart: number, windowEnd: number): Placed {
    const span = windowEnd - windowStart;
    return {
        leftPct: ((start - windowStart) / span) * 100,
        widthPct: ((end - start) / span) * 100,
    };
}

function clip<T extends TimeInterval>(items: T[], from: number, to: number): T[] {
    return items
        .filter(item => item.end > from && item.start < to)
        .map(item => ({ ...item, start: Math.max(item.start, from), end: Math.min(item.end, to) }))
        .sort((a, b) => a.start - b.start);
}

interface AppRun extends TimeInterval {
    appId: string;
    titleTimes: Map<string, number>;
}

/** Joins consecutive segments of one app (e.g. switching tabs) into one run. */
function appRuns(segments: ScreenSegmentInput[]): AppRun[] {
    const runs: AppRun[] = [];
    for (const segment of segments) {
        const last = runs[runs.length - 1];
        const run = last && last.appId === segment.appId && segment.start - last.end <= JOIN_GAP_MS
            ? last
            : null;
        const target = run ?? { appId: segment.appId, start: segment.start, end: segment.end, titleTimes: new Map() };
        if (!run) runs.push(target);
        target.end = Math.max(target.end, segment.end);
        if (segment.title) target.titleTimes.set(segment.title, (target.titleTimes.get(segment.title) ?? 0) + segment.end - segment.start);
    }
    return runs;
}

function topTitles(titleTimes: Map<string, number>): string[] {
    return [...titleTimes.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_TITLES).map(([title]) => title);
}

function sortedAppTimes(times: Map<string, number>, nameOf: (appId: string) => string): AppTime[] {
    return [...times.entries()]
        .map(([appId, ms]) => ({ appId, name: nameOf(appId), color: appColor(appId), ms }))
        .sort((a, b) => b.ms - a.ms);
}

type Unplaced<T> = T extends Placed ? Omit<T, keyof Placed> : never;

/** Groups bursts of short runs into "switching" blocks; longer runs stay as app blocks. */
function activityBlocks(runs: AppRun[], nameOf: (appId: string) => string): Unplaced<ScreenBlock>[] {
    const blocks: Unplaced<ScreenBlock>[] = [];
    let burst: AppRun[] = [];
    const flushBurst = () => {
        if (burst.length === 1) blocks.push(appBlock(burst[0], nameOf));
        if (burst.length > 1) {
            const times = new Map<string, number>();
            for (const run of burst) times.set(run.appId, (times.get(run.appId) ?? 0) + run.end - run.start);
            blocks.push({ kind: 'switching', start: burst[0].start, end: burst[burst.length - 1].end, apps: sortedAppTimes(times, nameOf) });
        }
        burst = [];
    };
    for (const run of runs) {
        const short = run.end - run.start < SHORT_MS;
        const continuesBurst = burst.length > 0 && run.start - burst[burst.length - 1].end <= JOIN_GAP_MS;
        if (short && (burst.length === 0 || continuesBurst)) {
            burst.push(run);
            continue;
        }
        flushBurst();
        if (short) burst.push(run);
        else blocks.push(appBlock(run, nameOf));
    }
    flushBurst();
    return blocks;
}

function appBlock(run: AppRun, nameOf: (appId: string) => string): Unplaced<ScreenBlock> {
    return { kind: 'app', start: run.start, end: run.end, appId: run.appId, name: nameOf(run.appId), color: appColor(run.appId), titles: topTitles(run.titleTimes) };
}

/** Splits a gap into the parts where tracking ran (away) and where it did not (untracked). */
function gapBlocks(gap: TimeInterval, tracked: TimeInterval[]): Unplaced<ScreenBlock>[] {
    const blocks: Unplaced<ScreenBlock>[] = [];
    let cursor = gap.start;
    for (const interval of clip(tracked, gap.start, gap.end)) {
        if (interval.start > cursor) blocks.push({ kind: 'untracked', start: cursor, end: interval.start });
        blocks.push({ kind: 'away', start: interval.start, end: interval.end });
        cursor = interval.end;
    }
    if (cursor < gap.end) blocks.push({ kind: 'untracked', start: cursor, end: gap.end });
    return blocks;
}

export interface ScreenLane {
    blocks: ScreenBlock[];
    appTimes: AppTime[];
    totalMs: number;
}

/**
 * The screen lane from the window start up to `now` (or the window end, if earlier). Later
 * time is left empty because it has not happened yet.
 */
export function buildScreenLane(
    { segments, tracked, nameOf }: { segments: ScreenSegmentInput[]; tracked: TimeInterval[]; nameOf: (appId: string) => string },
    windowStart: number,
    windowEnd: number,
    now: number,
): ScreenLane {
    const laneEnd = Math.min(windowEnd, now);
    if (laneEnd <= windowStart) return { blocks: [], appTimes: [], totalMs: 0 };
    const clipped = clip(segments, windowStart, laneEnd);

    const times = new Map<string, number>();
    for (const segment of clipped) times.set(segment.appId, (times.get(segment.appId) ?? 0) + segment.end - segment.start);
    const appTimes = sortedAppTimes(times, nameOf);

    const unplaced: Unplaced<ScreenBlock>[] = [];
    let cursor = windowStart;
    for (const block of activityBlocks(appRuns(clipped), nameOf)) {
        if (block.start > cursor) unplaced.push(...gapBlocks({ start: cursor, end: block.start }, tracked));
        unplaced.push(block);
        cursor = Math.max(cursor, block.end);
    }
    if (cursor < laneEnd) unplaced.push(...gapBlocks({ start: cursor, end: laneEnd }, tracked));

    return {
        blocks: unplaced.map(block => ({ ...block, ...place(block.start, block.end, windowStart, windowEnd) }) as ScreenBlock),
        appTimes,
        totalMs: appTimes.reduce((total, app) => total + app.ms, 0),
    };
}

/** Planned blocks in the window; overlapping ones go on separate rows. */
export function buildPlannedLane(items: PlannedInput[], windowStart: number, windowEnd: number): PlannedBlock[] {
    const blocks: PlannedBlock[] = [];
    let group: PlannedBlock[] = [];
    let rowEnds: number[] = [];
    let groupEnd = -Infinity;
    const closeGroup = () => {
        for (const block of group) block.columns = rowEnds.length;
        group = [];
        rowEnds = [];
    };
    for (const item of clip(items, windowStart, windowEnd)) {
        if (item.start >= groupEnd) {
            closeGroup();
            groupEnd = item.end;
        }
        groupEnd = Math.max(groupEnd, item.end);
        let row = rowEnds.findIndex(end => end <= item.start);
        if (row === -1) row = rowEnds.length;
        rowEnds[row] = item.end;
        const block = { ...item, row, columns: 1, ...place(item.start, item.end, windowStart, windowEnd) };
        group.push(block);
        blocks.push(block);
    }
    closeGroup();
    return blocks;
}

/** Whole hours inside the window, for axis ticks. */
export function hourTicks(windowStart: number, windowEnd: number): number[] {
    const first = new Date(windowStart);
    first.setMinutes(0, 0, 0);
    const ticks: number[] = [];
    for (let hour = first; hour.getTime() <= windowEnd; hour = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours() + 1)) {
        if (hour.getTime() >= windowStart) ticks.push(hour.getTime());
    }
    return ticks;
}

/**
 * The slot a click lands in: `fraction` (0 at the window start, 1 at its end) rounded down to
 * `stepMinutes`, as a chunk of `lengthMinutes` that is kept inside the window.
 */
export function slotAt(windowStart: number, windowEnd: number, fraction: number, stepMinutes = 30, lengthMinutes = 60): TimeInterval {
    const step = stepMinutes * 60_000;
    const length = Math.min(lengthMinutes * 60_000, windowEnd - windowStart);
    const at = windowStart + Math.min(Math.max(fraction, 0), 1) * (windowEnd - windowStart);
    // Rounded against local midnight, so half hours line up with the clock in every time zone.
    const midnight = new Date(at).setHours(0, 0, 0, 0);
    const start = Math.min(midnight + Math.floor((at - midnight) / step) * step, windowEnd - length);
    return { start: Math.max(start, windowStart), end: Math.max(start, windowStart) + length };
}
