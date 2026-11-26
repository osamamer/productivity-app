import { dateKey, taskDateKey } from './taskDate';

function normalizeHomeDayEndHour(hour: number): number {
    return Number.isInteger(hour) ? Math.min(5, Math.max(0, hour)) : 0;
}

export function getHomeDisplayDate(now: Date, dayEndHour: number): Date {
    const displayDate = new Date(now);
    displayDate.setHours(0, 0, 0, 0);
    if (now.getHours() < normalizeHomeDayEndHour(dayEndHour)) {
        displayDate.setDate(displayDate.getDate() - 1);
    }
    return displayDate;
}

export function getNextHomeDayBoundary(now: Date, dayEndHour: number): Date {
    const boundary = new Date(now);
    boundary.setHours(normalizeHomeDayEndHour(dayEndHour), 0, 0, 0);
    if (boundary <= now) boundary.setDate(boundary.getDate() + 1);
    return boundary;
}

function nextDateKey(dayKey: string): string {
    const next = new Date(`${dayKey}T12:00:00`);
    next.setDate(next.getDate() + 1);
    return dateKey(next);
}

/** The calendar date whose early hours, before the day-end hour, still belong to the Home day. */
export function homeDayTailDateKey(homeDayKey: string, dayEndHour: number): string | null {
    return normalizeHomeDayEndHour(dayEndHour) > 0 ? nextDateKey(homeDayKey) : null;
}

/**
 * Whether a task's schedule falls in the Home day: any time on its date, or the next date before
 * the day-end hour. Days therefore overlap: a 02:00 task belongs to the day before until the
 * day ends, then to its own date, so it never drops out of Home.
 */
export function isInHomeDay(scheduled: string | null | undefined, homeDayKey: string, dayEndHour: number): boolean {
    if (!scheduled) return false;
    const scheduledDate = taskDateKey(scheduled);
    if (scheduledDate === homeDayKey) return true;
    if (scheduledDate !== homeDayTailDateKey(homeDayKey, dayEndHour)) return false;
    return scheduledHour(scheduled) < normalizeHomeDayEndHour(dayEndHour);
}

function scheduledHour(scheduled: string): number {
    const localTime = /^\d{4}-\d{2}-\d{2}T(\d{2})/.exec(scheduled);
    const hasExplicitTimeZone = /T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(scheduled);
    if (localTime && !hasExplicitTimeZone) return Number(localTime[1]);
    const date = new Date(scheduled);
    return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getHours();
}
