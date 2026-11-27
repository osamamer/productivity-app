import { defaultTaskRecurrence, type TaskRecurrenceDraft } from '../../types/TaskRecurrence';
import type { TaskSeries } from '../../types/TaskSeries';
import {
    fieldsFromRepeatRule,
    repeatRuleFromFields,
    type RepeatRule,
} from '../../../../shared/repeatRule.ts';

/** The recurrence editor's starting value for a task's series; a stopped or missing series means no recurrence. */
export function recurrenceDraftFromSeries(series: TaskSeries | null | undefined): TaskRecurrenceDraft {
    if (!series?.active) return defaultTaskRecurrence();
    return {
        recurrenceFrequency: series.recurrenceFrequency,
        recurrenceEndDate: series.recurrenceEndDate,
        recurrenceInterval: series.recurrenceInterval,
        recurrenceUnit: series.recurrenceUnit,
        recurrenceDaysOfWeek: series.recurrenceDaysOfWeek ?? null,
        timeZone: series.timeZone,
    };
}

export function recurrenceDraftsEqual(first: TaskRecurrenceDraft, second: TaskRecurrenceDraft): boolean {
    return first.recurrenceFrequency === second.recurrenceFrequency
        && first.recurrenceEndDate === second.recurrenceEndDate
        && first.recurrenceInterval === second.recurrenceInterval
        && first.recurrenceUnit === second.recurrenceUnit
        && (first.recurrenceDaysOfWeek ?? []).join() === (second.recurrenceDaysOfWeek ?? []).join()
        && first.timeZone === second.timeZone;
}

export function repeatRuleFromDraft(draft: TaskRecurrenceDraft): RepeatRule {
    return repeatRuleFromFields(draft);
}

export function draftFromRepeatRule(rule: RepeatRule, timeZone: string): TaskRecurrenceDraft {
    return { ...fieldsFromRepeatRule(rule), timeZone };
}
