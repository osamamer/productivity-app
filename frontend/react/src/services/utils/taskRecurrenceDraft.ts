import { defaultTaskRecurrence, type TaskRecurrenceDraft } from '../../types/TaskRecurrence';
import type { TaskSeries } from '../../types/TaskSeries';

/**
 * The recurrence editor's starting value for a task's series; a stopped or missing series means
 * no recurrence. Weekdays are left out because the task recurrence editor does not offer them.
 */
export function recurrenceDraftFromSeries(series: TaskSeries | null | undefined): TaskRecurrenceDraft {
    if (!series?.active) return defaultTaskRecurrence();
    return {
        recurrenceFrequency: series.recurrenceFrequency,
        recurrenceEndDate: series.recurrenceEndDate,
        recurrenceInterval: series.recurrenceInterval,
        recurrenceUnit: series.recurrenceUnit,
        timeZone: series.timeZone,
    };
}

export function recurrenceDraftsEqual(first: TaskRecurrenceDraft, second: TaskRecurrenceDraft): boolean {
    return first.recurrenceFrequency === second.recurrenceFrequency
        && first.recurrenceEndDate === second.recurrenceEndDate
        && first.recurrenceInterval === second.recurrenceInterval
        && first.recurrenceUnit === second.recurrenceUnit
        && first.timeZone === second.timeZone;
}
