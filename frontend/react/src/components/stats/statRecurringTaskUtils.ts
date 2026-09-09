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

export function defaultStatRecurringTaskDraft(): StatRecurringTaskDraft {
    return {
        recurrenceFrequency: 'DAILY',
        recurrenceDaysOfWeek: [todayDay()],
    };
}
