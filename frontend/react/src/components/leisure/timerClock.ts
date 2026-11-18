import { type ActivitySession, sessionElapsedMs } from '../../types/ActivitySession.ts';

export interface TimerClock {
    elapsedMs: number;
    // Null for an open timer.
    remainingMs: number | null;
    // 0–100 for a countdown, null for an open timer.
    progress: number | null;
}

/** Where an activity timer stands at `now`; a countdown's total excludes time spent paused. */
export function timerClock(session: ActivitySession, now: number): TimerClock {
    const elapsedMs = sessionElapsedMs(session, now);
    if (!session.targetEndAt) return { elapsedMs, remainingMs: null, progress: null };
    const totalMs = Date.parse(session.targetEndAt) - Date.parse(session.startedAt) - session.pausedMillis;
    const progress = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 100;
    return { elapsedMs, remainingMs: totalMs - elapsedMs, progress };
}
