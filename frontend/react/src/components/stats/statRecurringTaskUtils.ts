import {
    StatRecurrenceDay, StatRecurringTaskDraft, StatWeeklyTaskScheduleDraft,
} from '../../types/Stats';

export const STAT_RECURRENCE_DAYS: { value: StatRecurrenceDay; label: string }[] = [
    { value: 'SUNDAY', label: 'S' },
    { value: 'MONDAY', label: 'M' },
    { value: 'TUESDAY', label: 'T' },
    { value: 'WEDNESDAY', label: 'W' },
    { value: 'THURSDAY', label: 'T' },
    { value: 'FRIDAY', label: 'F' },
    { value: 'SATURDAY', label: 'S' },
];

function todayDay(): StatRecurrenceDay {
    return STAT_RECURRENCE_DAYS[new Date().getDay()].value;
}

function currentTimeOfDay(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function upcomingTimeOfDay(): string {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 5);
    return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
}

export function timeOfDayFromDateTime(value: string): string {
    return /T(\d{2}:\d{2})/.exec(value)?.[1] ?? currentTimeOfDay();
}

export function defaultStatRecurringTaskDraft(): StatRecurringTaskDraft {
    return {
        recurrenceFrequency: 'DAILY',
        recurrenceDaysOfWeek: [todayDay()],
        timeOfDay: currentTimeOfDay(),
        importance: 3,
    };
}

export function defaultStatWeeklyTaskScheduleDraft(taskName = ''): StatWeeklyTaskScheduleDraft {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 5);
    return {
        taskName,
        daysOfWeek: [STAT_RECURRENCE_DAYS[next.getDay()].value],
        timeOfDay: upcomingTimeOfDay(),
        importance: 3,
    };
}

export function isStatScheduleDayAvailable(day: StatRecurrenceDay, timeOfDay: string): boolean {
    const dayIndex = STAT_RECURRENCE_DAYS.findIndex(option => option.value === day);
    const now = new Date();
    if (dayIndex < now.getDay()) return false;
    if (dayIndex > now.getDay()) return true;
    if (!/^\d{2}:\d{2}$/.test(timeOfDay)) return true;
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return new Date(`${date}T${timeOfDay}:00`).getTime() > now.getTime();
}
