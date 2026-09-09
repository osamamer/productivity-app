export type TaskRecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type TaskRecurrenceUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
export type TaskRecurrenceDay =
    'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type TaskRecurrenceDraft = {
    recurrenceFrequency: TaskRecurrenceFrequency;
    recurrenceEndDate: string | null;
    recurrenceInterval: number | null;
    recurrenceUnit: TaskRecurrenceUnit | null;
    recurrenceDaysOfWeek?: TaskRecurrenceDay[] | null;
    timeZone: string;
};

export const NO_TASK_RECURRENCE: TaskRecurrenceDraft = {
    recurrenceFrequency: 'NONE',
    recurrenceEndDate: null,
    recurrenceInterval: null,
    recurrenceUnit: null,
    recurrenceDaysOfWeek: null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

export function defaultTaskRecurrence(): TaskRecurrenceDraft {
    return {
        recurrenceFrequency: 'NONE',
        recurrenceEndDate: null,
        recurrenceInterval: null,
        recurrenceUnit: null,
        recurrenceDaysOfWeek: null,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    };
}
