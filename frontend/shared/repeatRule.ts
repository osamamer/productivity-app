/**
 * The repeat rule people edit (Daily, Weekly or Monthly, every N, on chosen weekdays) and its mapping to the
 * API's recurrence fields, shared by tasks and events on web and mobile.
 *
 * "Every N weeks on these days" follows iCalendar's FREQ=WEEKLY;INTERVAL=N;BYDAY=...;WKST=SU, like the backend's
 * WeekdayRecurrence: weeks start on Sunday, the start date's week is week 0 and only every Nth week repeats.
 */

export type Weekday = 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
export type RepeatKind = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type RepeatRule = {
    kind: RepeatKind;
    every: number;
    /** Only for WEEKLY; empty means the start date's weekday. */
    days: Weekday[];
    /** Inclusive, `YYYY-MM-DD`. */
    until: string | null;
};

export type RecurrenceFields = {
    recurrenceFrequency: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    recurrenceInterval: number | null;
    recurrenceUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
    recurrenceDaysOfWeek: Weekday[] | null;
    recurrenceEndDate: string | null;
};

/** Sunday first, matching the weekday buttons. */
export const WEEKDAYS: readonly Weekday[] = [
    'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
];

const SHORT_NAMES: Record<Weekday, string> = {
    SUNDAY: 'Sun', MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat',
};

export const NO_REPEAT: RepeatRule = { kind: 'NONE', every: 1, days: [], until: null };

export function weekdayShortName(day: Weekday): string {
    return SHORT_NAMES[day];
}

export function sortWeekdays(days: readonly Weekday[]): Weekday[] {
    return WEEKDAYS.filter(day => days.includes(day));
}

function clampEvery(value: number | null | undefined): number {
    return Number.isInteger(value) && (value as number) >= 1 ? Math.min(999, value as number) : 1;
}

export function repeatRuleFromFields(fields: Partial<RecurrenceFields> | null | undefined): RepeatRule {
    const frequency = fields?.recurrenceFrequency ?? 'NONE';
    const until = fields?.recurrenceEndDate ?? null;
    if (frequency === 'NONE') return NO_REPEAT;
    if (frequency === 'DAILY') return { kind: 'DAILY', every: 1, days: [], until };
    if (frequency === 'WEEKLY') return { kind: 'WEEKLY', every: 1, days: [], until };
    if (frequency === 'MONTHLY') return { kind: 'MONTHLY', every: 1, days: [], until };
    const every = clampEvery(fields?.recurrenceInterval);
    if (fields?.recurrenceUnit === 'DAYS') return { kind: 'DAILY', every, days: [], until };
    if (fields?.recurrenceUnit === 'MONTHS') return { kind: 'MONTHLY', every, days: [], until };
    return { kind: 'WEEKLY', every, days: sortWeekdays(fields?.recurrenceDaysOfWeek ?? []), until };
}

export function fieldsFromRepeatRule(rule: RepeatRule): RecurrenceFields {
    const every = clampEvery(rule.every);
    const base = { recurrenceEndDate: rule.kind === 'NONE' ? null : rule.until, recurrenceDaysOfWeek: null };
    const simple = (frequency: RecurrenceFields['recurrenceFrequency']): RecurrenceFields => ({
        ...base, recurrenceFrequency: frequency, recurrenceInterval: null, recurrenceUnit: null,
    });
    const custom = (unit: NonNullable<RecurrenceFields['recurrenceUnit']>): RecurrenceFields => ({
        ...base, recurrenceFrequency: 'CUSTOM', recurrenceInterval: every, recurrenceUnit: unit,
    });
    if (rule.kind === 'NONE') return simple('NONE');
    if (rule.kind === 'DAILY') return every === 1 ? simple('DAILY') : custom('DAYS');
    if (rule.kind === 'MONTHLY') return every === 1 ? simple('MONTHLY') : custom('MONTHS');
    if (rule.days.length === 0) return every === 1 ? simple('WEEKLY') : custom('WEEKS');
    return { ...custom('WEEKS'), recurrenceDaysOfWeek: sortWeekdays(rule.days) };
}

export function sameRepeatRule(first: RepeatRule, second: RepeatRule): boolean {
    const a = fieldsFromRepeatRule(first);
    const b = fieldsFromRepeatRule(second);
    return a.recurrenceFrequency === b.recurrenceFrequency
        && a.recurrenceInterval === b.recurrenceInterval
        && a.recurrenceUnit === b.recurrenceUnit
        && a.recurrenceEndDate === b.recurrenceEndDate
        && (a.recurrenceDaysOfWeek ?? []).join() === (b.recurrenceDaysOfWeek ?? []).join();
}

function unitWord(kind: RepeatKind, every: number): string {
    const word = kind === 'DAILY' ? 'day' : kind === 'WEEKLY' ? 'week' : 'month';
    return every === 1 ? word : `${every} ${word}s`;
}

/** "Every 2 weeks on Mon, Thu"; with `short`, "2 wk · Mon, Thu" for narrow places. */
export function repeatSummary(rule: RepeatRule, short = false): string {
    if (rule.kind === 'NONE') return "Doesn't repeat";
    const days = rule.kind === 'WEEKLY' && rule.days.length > 0
        ? sortWeekdays(rule.days).map(weekdayShortName).join(', ')
        : '';
    if (short) {
        const unit = rule.kind === 'DAILY' ? 'd' : rule.kind === 'WEEKLY' ? 'wk' : 'mo';
        const every = rule.every === 1
            ? { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' }[rule.kind]
            : `${rule.every} ${unit}`;
        return days ? `${every} · ${days}` : every;
    }
    const every = rule.every === 1
        ? { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' }[rule.kind]
        : `Every ${unitWord(rule.kind, rule.every)}`;
    return days ? `${rule.every === 1 ? 'Every week' : every} on ${days}` : every;
}

function utcDay(dateKey: string): number {
    const [year, month, day] = dateKey.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
}

function dateKeyFromUtcDay(day: number): string {
    return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

function weekdayOfUtcDay(day: number): Weekday {
    return WEEKDAYS[new Date(day * 86_400_000).getUTCDay()];
}

/** Whether `dateKey` is an occurrence of "every `interval` weeks on `days`" starting on `anchorKey`. */
export function isWeekdayOccurrence(anchorKey: string, dateKey: string, days: readonly Weekday[], interval: number): boolean {
    const anchor = utcDay(anchorKey);
    const date = utcDay(dateKey);
    if (date < anchor || !days.includes(weekdayOfUtcDay(date))) return false;
    const weekStart = (day: number) => day - new Date(day * 86_400_000).getUTCDay();
    const weeks = Math.round((weekStart(date) - weekStart(anchor)) / 7);
    return weeks % clampEvery(interval) === 0;
}

/** Occurrence dates of a weekday rule from `fromKey` up to and including `throughKey`. */
export function weekdayOccurrencesBetween(
    anchorKey: string,
    days: readonly Weekday[],
    interval: number,
    fromKey: string,
    throughKey: string,
): string[] {
    const dates: string[] = [];
    const first = Math.max(utcDay(anchorKey), utcDay(fromKey));
    for (let day = first; day <= utcDay(throughKey); day += 1) {
        const key = dateKeyFromUtcDay(day);
        if (isWeekdayOccurrence(anchorKey, key, days, interval)) dates.push(key);
    }
    return dates;
}

function addMonthsClamped(anchorKey: string, months: number): string {
    const [year, month, day] = anchorKey.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
}

/** The next `count` occurrence dates on or after `fromKey`, for previews like "Next: Mon 1 Dec". */
export function upcomingOccurrenceDates(rule: RepeatRule, anchorKey: string, fromKey: string, count: number): string[] {
    if (rule.kind === 'NONE') return [];
    const every = clampEvery(rule.every);
    const dates: string[] = [];
    const within = (key: string) => rule.until === null || key <= rule.until;
    if (rule.kind === 'WEEKLY' && rule.days.length > 0) {
        for (let day = Math.max(utcDay(anchorKey), utcDay(fromKey)); dates.length < count; day += 1) {
            const key = dateKeyFromUtcDay(day);
            if (!within(key)) break;
            if (isWeekdayOccurrence(anchorKey, key, rule.days, every)) dates.push(key);
        }
        return dates;
    }
    for (let index = 0; dates.length < count && index < 10_000; index += 1) {
        const key = rule.kind === 'MONTHLY'
            ? addMonthsClamped(anchorKey, index * every)
            : dateKeyFromUtcDay(utcDay(anchorKey) + index * every * (rule.kind === 'WEEKLY' ? 7 : 1));
        if (!within(key)) break;
        if (key >= fromKey) dates.push(key);
    }
    return dates;
}

export function weekdayOfDateKey(dateKey: string): Weekday {
    return weekdayOfUtcDay(utcDay(dateKey));
}
