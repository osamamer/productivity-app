import { StatRecurrenceDay, StatRecurringTaskDraft } from '../../types/Stats';

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
