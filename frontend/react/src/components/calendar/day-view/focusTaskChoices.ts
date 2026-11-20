import { addDays, format, isSameDay } from 'date-fns';
import { Task } from '../../../types/Task';
import { taskDateKey, dateKey } from '../../../services/utils/taskDate';
import { normalizeTaskSearchText } from '../../../services/utils/taskSearch';

type ChoiceTask = Pick<Task, 'taskId' | 'name' | 'importance' | 'scheduledPerformDateTime' | 'taskSeriesId'>;

export type PriorityBand = 'high' | 'medium' | 'low';

export function priorityBand(importance: number): PriorityBand {
    if (importance > 7) return 'high';
    if (importance > 4) return 'medium';
    return 'low';
}

const BAND_RANK: Record<PriorityBand, number> = { high: 0, medium: 1, low: 2 };

/** Backend schedules are LocalDateTime strings, so they are read as local time. */
function scheduledAt(task: ChoiceTask): Date | null {
    if (!task.scheduledPerformDateTime) return null;
    const date = new Date(task.scheduledPerformDateTime);
    return Number.isNaN(date.getTime()) ? null : date;
}

function nameMatchRank(name: string, needle: string): number {
    if (!needle) return 0;
    const normalized = normalizeTaskSearchText(name);
    if (normalized === needle) return 0;
    if (normalized.startsWith(needle)) return 1;
    return 2;
}

function matchesName(name: string, terms: string[]): boolean {
    const normalized = normalizeTaskSearchText(name);
    return terms.every(term => normalized.includes(term));
}

/**
 * Orders tasks for planning focus at `chunkStart`: tasks scheduled that day come first, then
 * higher priority, then the ones scheduled closest to the chunk, then the closest name match.
 * A recurring series shows only its occurrence nearest the chunk, so it is not listed once per day.
 */
export function rankFocusTaskChoices<T extends ChoiceTask>(tasks: T[], query: string, chunkStart: Date): T[] {
    const needle = normalizeTaskSearchText(query);
    const terms = needle.split(' ').filter(Boolean);
    const chunkDay = dateKey(chunkStart);
    const keyOf = (task: T) => {
        const at = scheduledAt(task);
        return {
            otherDay: task.scheduledPerformDateTime && taskDateKey(task.scheduledPerformDateTime) === chunkDay ? 0 : 1,
            band: BAND_RANK[priorityBand(task.importance)],
            distance: at ? Math.abs(at.getTime() - chunkStart.getTime()) : Number.POSITIVE_INFINITY,
            match: nameMatchRank(task.name, needle),
        };
    };
    const ranked = tasks
        .filter(task => matchesName(task.name, terms))
        .map(task => ({ task, key: keyOf(task) }))
        .sort((a, b) => a.key.otherDay - b.key.otherDay
            || a.key.band - b.key.band
            || a.key.distance - b.key.distance
            || a.key.match - b.key.match
            || a.task.name.localeCompare(b.task.name))
        .map(({ task }) => task);
    return nearestOccurrencePerSeries(ranked, chunkStart);
}

function nearestOccurrencePerSeries<T extends ChoiceTask>(ranked: T[], chunkStart: Date): T[] {
    const distance = (task: T) => {
        const at = scheduledAt(task);
        return at ? Math.abs(at.getTime() - chunkStart.getTime()) : Number.POSITIVE_INFINITY;
    };
    const nearest = new Map<string, T>();
    for (const task of ranked) {
        if (!task.taskSeriesId) continue;
        const kept = nearest.get(task.taskSeriesId);
        if (!kept || distance(task) < distance(kept)) nearest.set(task.taskSeriesId, task);
    }
    return ranked.filter(task => !task.taskSeriesId || nearest.get(task.taskSeriesId) === task);
}

/** A short "when" for a task row: Today 4:00 PM, Tomorrow, Mon 23 Nov, or Unscheduled. */
export function scheduleLabel(task: Pick<Task, 'scheduledPerformDateTime'>, now: Date): string {
    const at = task.scheduledPerformDateTime ? new Date(task.scheduledPerformDateTime) : null;
    if (!at || Number.isNaN(at.getTime())) return 'Unscheduled';
    const day = isSameDay(at, now) ? 'Today'
        : isSameDay(at, addDays(now, 1)) ? 'Tomorrow'
            : isSameDay(at, addDays(now, -1)) ? 'Yesterday'
                : format(at, at.getFullYear() === now.getFullYear() ? 'EEE d MMM' : 'd MMM yyyy');
    const hasTime = at.getHours() !== 0 || at.getMinutes() !== 0;
    return hasTime ? `${day} ${format(at, 'p')}` : day;
}
