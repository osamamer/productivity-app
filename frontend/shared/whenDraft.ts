import { NO_REPEAT, sameRepeatRule, type RepeatRule } from './repeatRule';

/**
 * What the When popup edits for a task, and what a save changed. Shared by web and mobile so both apply
 * "this occurrence" and "all occurrences" the same way.
 */

export type ChangeScope = 'occurrence' | 'all';

/** `date` is `YYYY-MM-DD` or empty for no date; `time` is `HH:mm`. */
export type WhenDraft = {
    date: string;
    time: string;
    reminderMinutesBefore: number | null;
    repeat: RepeatRule;
    repeatSubtasks: boolean;
};

export type WhenChange = {
    next: WhenDraft;
    scheduleChanged: boolean;
    reminderChanged: boolean;
    repeatChanged: boolean;
    scheduleScope: ChangeScope;
    reminderScope: ChangeScope;
};

export const REMINDER_PRESETS = [
    { minutes: 0, label: 'At time' },
    { minutes: 15, label: '15 min' },
    { minutes: 60, label: '1 hour' },
    { minutes: 1440, label: '1 day' },
] as const;

const pad = (value: number) => String(value).padStart(2, '0');

export function emptyWhenDraft(): WhenDraft {
    return { date: '', time: '09:00', reminderMinutesBefore: null, repeat: NO_REPEAT, repeatSubtasks: false };
}

/** Splits a local `YYYY-MM-DDTHH:mm[:ss]` schedule (or any date string) into the popup's date and time. */
export function whenDraftFromSchedule(
    scheduled: string | null | undefined,
    reminderMinutesBefore: number | null | undefined,
    repeat: RepeatRule,
    repeatSubtasks: boolean,
): WhenDraft {
    let date = '';
    let time = '09:00';
    const match = scheduled ? /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(scheduled) : null;
    if (match) {
        [, date, time] = match;
    } else if (scheduled) {
        const parsed = new Date(scheduled);
        if (!Number.isNaN(parsed.getTime())) {
            date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
            time = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
        }
    }
    return { date, time, reminderMinutesBefore: date ? reminderMinutesBefore ?? null : null, repeat, repeatSubtasks };
}

/** `YYYY-MM-DDTHH:mm:00`, or empty when there is no date. */
export function scheduleOf(draft: WhenDraft): string {
    return draft.date ? `${draft.date}T${draft.time || '09:00'}:00` : '';
}

export function describeChange(initial: WhenDraft, next: WhenDraft, scopes: {
    scheduleScope: ChangeScope;
    reminderScope: ChangeScope;
}): WhenChange {
    return {
        next,
        scheduleChanged: scheduleOf(initial) !== scheduleOf(next),
        reminderChanged: initial.reminderMinutesBefore !== next.reminderMinutesBefore,
        repeatChanged: !sameRepeatRule(initial.repeat, next.repeat) || initial.repeatSubtasks !== next.repeatSubtasks,
        ...scopes,
    };
}

/** The series start for "all occurrences": a new date moves the series, a time-only change keeps its first date. */
export function seriesStartFor(change: WhenChange, initial: WhenDraft, seriesStartDateTime: string): string {
    const date = change.next.date === initial.date ? seriesStartDateTime.slice(0, 10) : change.next.date;
    return `${date}T${change.next.time}:00`;
}

function amountLabel(minutes: number): string {
    if (minutes % 1440 === 0) return minutes === 1440 ? '1 day' : `${minutes / 1440} days`;
    if (minutes % 60 === 0) return minutes === 60 ? '1 hour' : `${minutes / 60} hours`;
    return `${minutes} min`;
}

/** "15 min before", "At time" or "No reminder"; `short` drops "before". */
export function reminderLabel(minutes: number | null, short = false): string {
    if (minutes === null) return 'No reminder';
    if (minutes === 0) return 'At time';
    return short ? amountLabel(minutes) : `${amountLabel(minutes)} before`;
}
