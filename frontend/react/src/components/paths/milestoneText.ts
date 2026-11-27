import { format, parseISO } from 'date-fns';
import type { Checkpoint, Milestone } from '../../types/Path';
import { formatInputValue } from './signalText';

export function shortDate(date: string): string {
    return format(parseISO(`${date}T12:00:00`), 'MMM d');
}

/** The line under a ring's name: "49% · Jul 22", "Done · Jun 20", "not planned yet". */
export function milestoneSubtitle(milestone: Milestone): string {
    if (milestone.done && milestone.doneOn) return `Done · ${shortDate(milestone.doneOn)}`;
    if (!milestone.targetDate) return 'not planned yet';
    return `${Math.round(milestone.progress * 100)}% · ${shortDate(milestone.targetDate)}`;
}

/** "72k of 99k words", "85, down to 80 kg", "12 of 30 days". */
export function checkpointMetricText(checkpoint: Checkpoint): string {
    const { metric } = checkpoint;
    const value = (amount: number) => formatInputValue(amount, metric.valueType, metric.unit);
    const bare = (amount: number) => formatInputValue(amount, metric.valueType, null);
    if (checkpoint.current === null) return `nothing logged yet, target ${value(metric.targetValue)}`;
    if (metric.aggregation === 'COUNT_DAYS') return `${checkpoint.current} of ${metric.targetValue} days`;
    return metric.falling
        ? `${bare(checkpoint.current)}, down to ${value(metric.targetValue)}`
        : `${bare(checkpoint.current)} of ${value(metric.targetValue)}`;
}

/** A checkpoint tick's hover label: name, date and metric progress. */
export function checkpointLabel(checkpoint: Checkpoint): string {
    const parts = [checkpoint.name];
    if (checkpoint.targetDate) parts.push(shortDate(checkpoint.targetDate));
    parts.push(checkpoint.reachedOn ? `✓ reached ${shortDate(checkpoint.reachedOn)}` : checkpointMetricText(checkpoint));
    return parts.join(' · ');
}
