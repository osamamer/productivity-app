// Pure rules for the leisure home: how much time each activity got, and how a running clock reads.
// Times are epoch milliseconds.
import { type ActivitySession, sessionElapsedMs } from '../../types/ActivitySession.ts';

export interface ActivityTime {
    // Null groups timers that were not started for an activity.
    activityId: string | null;
    ms: number;
}

/** Timed milliseconds per activity, longest first; a running timer counts up to now. */
export function timeByActivity(sessions: ActivitySession[], now: number): ActivityTime[] {
    const totals = new Map<string | null, number>();
    for (const session of sessions) {
        totals.set(session.activityId, (totals.get(session.activityId) ?? 0) + sessionElapsedMs(session, now));
    }
    return [...totals.entries()]
        .map(([activityId, ms]) => ({ activityId, ms }))
        .filter(total => total.ms > 0)
        .sort((a, b) => b.ms - a.ms);
}

/** "12:05" or "1:02:05": a running clock reads better with seconds. */
export function formatClock(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => String(value).padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
