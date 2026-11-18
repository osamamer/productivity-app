/** Time actually spent on an activity, timed from Home's Leisure view (not a pomodoro). */
export interface ActivitySession {
    id: string;
    activityId: string | null;
    // The planned chunk it was started from, if any.
    eventId: string | null;
    title: string;
    startedAt: string;
    endedAt: string | null;
    pausedAt: string | null;
    pausedMillis: number;
    // Set for a countdown.
    targetEndAt: string | null;
    elapsedSeconds: number;
    active: boolean;
    paused: boolean;
}

export interface StartActivitySessionInput {
    activityId?: string | null;
    eventId?: string | null;
    title?: string;
    targetEndAt?: string | null;
}

/** Milliseconds spent so far, without pauses, worked out locally so the clock can tick. */
export function sessionElapsedMs(session: ActivitySession, now: number): number {
    const start = Date.parse(session.startedAt);
    const until = session.endedAt ? Date.parse(session.endedAt) : session.pausedAt ? Date.parse(session.pausedAt) : now;
    return Math.max(0, until - start - session.pausedMillis);
}
