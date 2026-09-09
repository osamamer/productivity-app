import { TaskSeries } from '../../types/TaskSeries';
import { CachedResource } from './ttlCache';
import { getAuthCacheScope } from '../utils/authHeaders';

// Recurrence is part of task details and changes only when the user edits the
// recurrence controls. Keep it warm long enough for the Home page to reuse it
// while still invalidating it immediately after a recurrence mutation.
export const TASK_SERIES_TTL_MS = 60 * 60 * 1000;

const taskSeriesResource = new CachedResource<TaskSeries | null>({
    ttlMs: TASK_SERIES_TTL_MS,
    maxEntries: 500,
});

function cacheKey(taskId: string): string {
    return `${getAuthCacheScope()}:${taskId}`;
}

export function getCachedTaskSeries(taskId: string): TaskSeries | null | undefined {
    return taskSeriesResource.getCached(cacheKey(taskId));
}

export function getStaleTaskSeries(taskId: string): TaskSeries | null | undefined {
    return taskSeriesResource.getStale(cacheKey(taskId));
}

export function loadTaskSeries(
    taskId: string,
    loader: () => Promise<TaskSeries | null>,
    forceRefresh = false,
): Promise<TaskSeries | null> {
    const key = cacheKey(taskId);
    if (forceRefresh) taskSeriesResource.invalidate(key);
    return taskSeriesResource.get(key, loader, TASK_SERIES_TTL_MS);
}

export function setCachedTaskSeries(taskId: string, series: TaskSeries | null): void {
    taskSeriesResource.set(cacheKey(taskId), series, TASK_SERIES_TTL_MS);
}

export function invalidateTaskSeries(taskId: string): void {
    taskSeriesResource.invalidate(cacheKey(taskId));
}

export function clearTaskSeriesCache(): void {
    taskSeriesResource.clear();
}
