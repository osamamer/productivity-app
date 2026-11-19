import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { StatDefinition, StatType } from '../../types/Stats';
import { timeValueFromScale, timeValueToScale } from '../../services/utils/statValues';

export type StatAverageKind = 'mean' | 'median';

type SummaryDefinition = Pick<StatDefinition, 'type' | 'morality' | 'systemKey'>;

/** Only counts and lengths have a meaningful zero; sleep hours are never "zero" on an unlogged night. */
export function supportsUnloggedDaysAsZero(type: StatType, systemKey?: string | null): boolean {
    return (type === 'NUMBER' || type === 'RANGE' || type === 'DURATION') && systemKey !== 'sleep_hours';
}

export function mean(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

export function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Days between `averageStartDate` and `to` with no value. They count as zeroes when the viewer asks
 * for it; `averageStartDate` is the later of the period start and the stat's first ever log.
 */
export function unloggedDayCount(loggedDays: number, averageStartDate: string | null | undefined, to: string): number {
    if (!averageStartDate) return 0;
    const eligibleDays = differenceInCalendarDays(parseISO(to), parseISO(averageStartDate)) + 1;
    return Math.max(0, eligibleDays - loggedDays);
}

/**
 * The period's average as a mean or median. Time values are averaged on the stat's linear scale so
 * bedtimes either side of midnight average sensibly. Returns null when there is nothing to average.
 */
export function statPeriodAverage(
    definition: SummaryDefinition,
    values: number[],
    kind: StatAverageKind,
    zeroDays = 0,
): number | null {
    const average = kind === 'median' ? median : mean;
    if (definition.type === 'TIME') {
        const linear = average(values.map(value => timeValueToScale(definition, value)));
        return linear === null ? null : timeValueFromScale(definition, linear);
    }
    return average(zeroDays > 0 ? [...values, ...Array<number>(zeroDays).fill(0)] : values);
}

/** Lower is better for stats to avoid, and for good times (an earlier bedtime or wake-up). */
function lowerIsBetter(definition: SummaryDefinition): boolean {
    return definition.type === 'TIME'
        ? definition.morality === 'GOOD'
        : definition.morality === 'BAD' || definition.morality === 'NICE_TO_AVOID';
}

/** The best value within the period, following the stat's direction like the all-time best does. */
export function statPeriodBest(definition: SummaryDefinition, values: number[]): number | null {
    if (values.length === 0) return null;
    const scale = (value: number) => (definition.type === 'TIME' ? timeValueToScale(definition, value) : value);
    const lower = lowerIsBetter(definition);
    return values.reduce((best, value) => ((lower ? scale(value) < scale(best) : scale(value) > scale(best)) ? value : best));
}
