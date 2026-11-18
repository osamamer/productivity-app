// Pure rules for the screen-time report: which dates a period covers and how days group into bars.
import { addDays, addMonths, addWeeks, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { appColor, type AppTime } from '../day/dayTimelineLayout.ts';

export type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';

export const REPORT_PERIODS: { value: ReportPeriod; label: string; description: string }[] = [
    { value: 'week', label: '1W', description: 'last 7 days' },
    { value: 'month', label: '1M', description: 'last 30 days' },
    { value: 'quarter', label: '3M', description: 'last 90 days' },
    { value: 'year', label: '1Y', description: 'last 365 days' },
];

const PERIOD_DAYS: Record<ReportPeriod, number> = { week: 7, month: 30, quarter: 90, year: 365 };

export interface DailyTotalInput {
    date: string;
    totalMs: number;
    apps: Record<string, number>;
}

export interface ReportWindow {
    // Local midnights; `to` is the start of tomorrow so today counts.
    from: Date;
    to: Date;
}

export type BucketUnit = 'day' | 'week' | 'month';

export interface ReportBucket {
    start: Date;
    end: Date;
    totalMs: number;
    unit: BucketUnit;
}

export interface ReportSummary {
    totalMs: number;
    daysWithScreenTime: number;
    // Averaged over days that had screen time, so days the computer was off do not pull it down.
    averageMs: number;
}

/** The period ending today, in whole local days. */
export function reportWindow(period: ReportPeriod, now: Date): ReportWindow {
    const to = addDays(startOfDay(now), 1);
    return { from: addDays(to, -PERIOD_DAYS[period]), to };
}

/** Days for a week or month, weeks for three months, months for a year: always a readable number of bars. */
export function bucketUnit(period: ReportPeriod): BucketUnit {
    if (period === 'quarter') return 'week';
    if (period === 'year') return 'month';
    return 'day';
}

function bucketStart(date: Date, unit: BucketUnit): Date {
    if (unit === 'week') return startOfWeek(date, { weekStartsOn: 1 });
    if (unit === 'month') return startOfMonth(date);
    return startOfDay(date);
}

function nextBucket(date: Date, unit: BucketUnit): Date {
    if (unit === 'week') return addWeeks(date, 1);
    if (unit === 'month') return addMonths(date, 1);
    return addDays(date, 1);
}

/**
 * Every bucket the window touches, oldest first, including empty ones so gaps show. The first
 * and last week or month may be partial; their bars only count the days inside the window.
 */
export function bucketDays(days: DailyTotalInput[], period: ReportPeriod, window: ReportWindow): ReportBucket[] {
    const unit = bucketUnit(period);
    const buckets: ReportBucket[] = [];
    for (let start = bucketStart(window.from, unit); start < window.to; start = nextBucket(start, unit)) {
        buckets.push({ start, end: nextBucket(start, unit), totalMs: 0, unit });
    }
    for (const day of days) {
        const date = new Date(`${day.date}T12:00:00`);
        if (date < window.from || date >= window.to) continue;
        const bucket = buckets.find(candidate => date >= candidate.start && date < candidate.end);
        if (bucket) bucket.totalMs += day.totalMs;
    }
    return buckets;
}

function inWindow(days: DailyTotalInput[], window: ReportWindow): DailyTotalInput[] {
    const fromKey = format(window.from, 'yyyy-MM-dd');
    const toKey = format(window.to, 'yyyy-MM-dd');
    return days.filter(day => day.date >= fromKey && day.date < toKey);
}

export function reportSummary(days: DailyTotalInput[], window: ReportWindow): ReportSummary {
    const counted = inWindow(days, window).filter(day => day.totalMs > 0);
    const totalMs = counted.reduce((total, day) => total + day.totalMs, 0);
    return { totalMs, daysWithScreenTime: counted.length, averageMs: counted.length ? totalMs / counted.length : 0 };
}

/** Total time per app across the window, longest first. */
export function reportAppTimes(days: DailyTotalInput[], window: ReportWindow, nameOf: (appId: string) => string): AppTime[] {
    const times = new Map<string, number>();
    for (const day of inWindow(days, window)) {
        for (const [appId, ms] of Object.entries(day.apps)) times.set(appId, (times.get(appId) ?? 0) + ms);
    }
    return [...times.entries()]
        .map(([appId, ms]) => ({ appId, name: nameOf(appId), color: appColor(appId), ms }))
        .sort((a, b) => b.ms - a.ms);
}

export function bucketLabel(bucket: ReportBucket): string {
    if (bucket.unit === 'month') return format(bucket.start, 'MMM');
    if (bucket.unit === 'week') return format(bucket.start, 'MMM d');
    return format(bucket.start, 'EEE d');
}

export function bucketTitle(bucket: ReportBucket): string {
    if (bucket.unit === 'month') return format(bucket.start, 'MMMM yyyy');
    if (bucket.unit === 'week') return `Week of ${format(bucket.start, 'MMM d')}`;
    return format(bucket.start, 'EEEE, MMM d');
}
