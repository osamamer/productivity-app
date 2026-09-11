import {
    addMonths,
    addQuarters,
    addWeeks,
    addYears,
    endOfMonth,
    endOfQuarter,
    endOfWeek,
    endOfYear,
    format,
    startOfDay,
    startOfMonth,
    startOfQuarter,
    startOfWeek,
    startOfYear,
    subDays,
} from 'date-fns';

export type StatPeriodMode = 'last' | 'current';
export type StatPeriodOffset = number;

export interface StatPeriodWindow {
    from: string;
    to: string;
    key: string;
    label: string;
}

export function formatStatBucketRange(from: Date, to: Date): string {
    return `${format(from, 'MMM d')} - ${format(to, 'MMM d')}`;
}

export function getStatPeriodWindow(
    dateRange: number,
    mode: StatPeriodMode,
    periodOffset: StatPeriodOffset = 0,
    today = new Date(),
): StatPeriodWindow {
    const end = startOfDay(today);
    if (mode === 'last') {
        const from = subDays(end, dateRange - 1);
        const fromString = format(from, 'yyyy-MM-dd');
        const toString = format(end, 'yyyy-MM-dd');
        const label = dateRange === 7
            ? 'Last 7 days'
            : dateRange === 30
                ? 'Last 30 days'
                : dateRange === 90
                    ? 'Last 3 months'
                    : 'Last year';
        return {
            from: fromString,
            to: toString,
            key: `${fromString}:${toString}`,
            label,
        };
    }

    const offset = Math.min(0, periodOffset);
    const baseStart = dateRange === 7
        ? startOfWeek(end, { weekStartsOn: 0 })
        : dateRange === 30
            ? startOfMonth(end)
            : dateRange === 90
                ? startOfQuarter(end)
                : startOfYear(end);
    const from = dateRange === 7
        ? addWeeks(baseStart, offset)
        : dateRange === 30
            ? addMonths(baseStart, offset)
            : dateRange === 90
                ? addQuarters(baseStart, offset)
                : addYears(baseStart, offset);
    const periodEnd = dateRange === 7
        ? endOfWeek(from, { weekStartsOn: 0 })
        : dateRange === 30
            ? endOfMonth(from)
            : dateRange === 90
                ? endOfQuarter(from)
                : endOfYear(from);
    const to = offset === 0 ? end : periodEnd;
    const fromString = format(from, 'yyyy-MM-dd');
    const toString = format(to, 'yyyy-MM-dd');
    const label = dateRange === 7
        ? formatStatBucketRange(from, periodEnd)
        : dateRange === 30
            ? format(from, 'MMMM yyyy')
            : dateRange === 90
                ? `${format(from, 'MMM yyyy')} - ${format(periodEnd, 'MMM yyyy')}`
                : format(from, 'yyyy');

    return {
        from: fromString,
        to: toString,
        key: `${fromString}:${toString}`,
        label,
    };
}
