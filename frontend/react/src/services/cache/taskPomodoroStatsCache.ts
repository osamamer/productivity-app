import { TaskPomodoroStats } from '../../types/TaskPomodoroStats';
import { CachedResource } from './ttlCache';
import { getAuthCacheScope } from '../utils/authHeaders';

// Focus history changes less often than the task list, so keep it warm between task switches.
// Mutations invalidate the relevant entry immediately.
export const TASK_POMODORO_STATS_TTL_MS = 15 * 60 * 1000;

const taskPomodoroStatsResource = new CachedResource<TaskPomodoroStats>({
    ttlMs: TASK_POMODORO_STATS_TTL_MS,
    maxEntries: 500,
});

const invalidationListeners = new Map<string, Set<() => void>>();

function cacheKey(taskId: string): string {
    return `${getAuthCacheScope()}:${taskId}`;
}

export function getCachedTaskPomodoroStats(taskId: string): TaskPomodoroStats | undefined {
    return taskPomodoroStatsResource.getCached(cacheKey(taskId));
}

export function getStaleTaskPomodoroStats(taskId: string): TaskPomodoroStats | undefined {
    return taskPomodoroStatsResource.getStale(cacheKey(taskId));
}

export function loadTaskPomodoroStats(
    taskId: string,
    loader: () => Promise<TaskPomodoroStats>,
    forceRefresh = false,
): Promise<TaskPomodoroStats> {
    const key = cacheKey(taskId);
    if (forceRefresh) taskPomodoroStatsResource.invalidate(key);
    return taskPomodoroStatsResource.get(key, loader, TASK_POMODORO_STATS_TTL_MS);
}

export function invalidateTaskPomodoroStats(taskId: string): void {
    const key = cacheKey(taskId);
    taskPomodoroStatsResource.invalidate(key);
    invalidationListeners.get(key)?.forEach(listener => listener());
}

export function subscribeToTaskPomodoroStatsInvalidation(
    taskId: string,
    listener: () => void,
): () => void {
    const key = cacheKey(taskId);
    const listeners = invalidationListeners.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    invalidationListeners.set(key, listeners);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) invalidationListeners.delete(key);
    };
}
