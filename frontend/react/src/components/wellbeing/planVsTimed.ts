// Pure rules for "planned and timed": how much time chunks set aside for each activity, and how
// much was actually timed, over a report window. Times are epoch milliseconds.
import { type ActivitySession, sessionElapsedMs } from '../../types/ActivitySession.ts';
import { reportBuckets, type ReportBucket, type ReportPeriod, type ReportWindow } from './screenTimeReport.ts';

export interface Span {
    // Null for a timer that was not for any activity; planned spans always have one.
    activityId: string | null;
    start: number;
    end: number;
}

export interface ActivityComparison {
    activityId: string | null;
    plannedMs: number;
    timedMs: number;
}

export interface ComparisonBucket extends ReportBucket {
    plannedMs: number;
    timedMs: number;
}

/**
 * A timer as a span of its counted time: from its start, as long as it ran without pauses. The
 * server keeps only the pause total, so this is where the time would sit with pauses removed.
 */
export function timedSpan(session: ActivitySession, now: number): Span {
    const start = Date.parse(session.startedAt);
    return { activityId: session.activityId, start, end: start + sessionElapsedMs(session, now) };
}

/** A timer takes precedence for any time already recorded manually. */
export function addClassifiedScreenTime(timed: Span[], screen: Span[]): Span[] {
    const occupied: Span[] = [];
    for (const span of [...timed].sort((a, b) => a.start - b.start)) {
        const last = occupied[occupied.length - 1];
        if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
        else occupied.push({ ...span });
    }

    let firstOverlap = 0;
    const additions: Span[] = [];
    for (const span of [...screen].sort((a, b) => a.start - b.start)) {
        let start = span.start;
        while (occupied[firstOverlap]?.end <= start) firstOverlap++;
        for (let i = firstOverlap; i < occupied.length && occupied[i].start < span.end; i++) {
            const timer = occupied[i];
            if (timer.start > start) additions.push({ ...span, start, end: timer.start });
            start = Math.max(start, timer.end);
            if (start >= span.end) break;
        }
        if (start < span.end) additions.push({ ...span, start });
    }
    return [...timed, ...additions];
}

function overlap(span: Span, from: number, to: number): number {
    return Math.max(0, Math.min(span.end, to) - Math.max(span.start, from));
}

/** Plans count only up to now: a chunk later today has not had its chance yet. */
function countedUntil(window: ReportWindow, now: number): number {
    return Math.min(window.to.getTime(), now);
}

export function compareByActivity(planned: Span[], timed: Span[], window: ReportWindow, now: number): ActivityComparison[] {
    const from = window.from.getTime();
    const to = countedUntil(window, now);
    const totals = new Map<string | null, ActivityComparison>();
    const entry = (activityId: string | null) => {
        const existing = totals.get(activityId) ?? { activityId, plannedMs: 0, timedMs: 0 };
        totals.set(activityId, existing);
        return existing;
    };
    for (const span of planned) if (span.activityId) entry(span.activityId).plannedMs += overlap(span, from, to);
    for (const span of timed) entry(span.activityId).timedMs += overlap(span, from, to);
    return [...totals.values()]
        .filter(total => total.plannedMs > 0 || total.timedMs > 0)
        .sort((a, b) => Math.max(b.plannedMs, b.timedMs) - Math.max(a.plannedMs, a.timedMs));
}

/** Planned and timed time per day, week or month, matching the screen-time bars. */
export function compareByBucket(planned: Span[], timed: Span[], period: ReportPeriod, window: ReportWindow, now: number): ComparisonBucket[] {
    const until = countedUntil(window, now);
    const from = window.from.getTime();
    return reportBuckets(period, window).map(bucket => {
        const start = Math.max(bucket.start.getTime(), from);
        const end = Math.min(bucket.end.getTime(), until);
        const sum = (spans: Span[]) => spans.reduce((total, span) => total + overlap(span, start, end), 0);
        return { ...bucket, plannedMs: sum(planned.filter(span => span.activityId)), timedMs: sum(timed) };
    });
}
