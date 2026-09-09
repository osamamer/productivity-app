import { Task } from '../../types/Task';
import { TaskSeries } from '../../types/TaskSeries';
import { CachedResource } from './ttlCache';
import { getAuthCacheScope } from '../utils/authHeaders';

export type TaskDetailsCacheEntry = {
    task: Task;
    subtasks: Task[];
    taskSeries: TaskSeries | null;
};

// Home opens details inline, so keep the complete detail view together per
// task. This avoids rendering one field from a different cache generation
// than the other fields.
export const TASK_DETAILS_TTL_MS = 60 * 60 * 1000;

const taskDetailsResource = new CachedResource<TaskDetailsCacheEntry>({
    ttlMs: TASK_DETAILS_TTL_MS,
    maxEntries: 500,
});

function cacheKey(taskId: string): string {
    return `${getAuthCacheScope()}:${taskId}`;
}

export function getCachedTaskDetails(taskId: string): TaskDetailsCacheEntry | undefined {
    return taskDetailsResource.getCached(cacheKey(taskId));
}

export function getStaleTaskDetails(taskId: string): TaskDetailsCacheEntry | undefined {
    return taskDetailsResource.getStale(cacheKey(taskId));
}

export function loadTaskDetails(
    taskId: string,
    loader: () => Promise<TaskDetailsCacheEntry>,
): Promise<TaskDetailsCacheEntry> {
    return taskDetailsResource.get(cacheKey(taskId), loader, TASK_DETAILS_TTL_MS);
}

export function setCachedTaskDetails(taskId: string, details: TaskDetailsCacheEntry): void {
    taskDetailsResource.set(cacheKey(taskId), details, TASK_DETAILS_TTL_MS);
}

export function updateCachedTaskDetails(
    taskId: string,
    updates: Partial<Omit<TaskDetailsCacheEntry, 'task'>> & { task?: Task },
    fallback?: TaskDetailsCacheEntry,
): void {
    const cached = getStaleTaskDetails(taskId);
    if (!cached) {
        if (fallback) setCachedTaskDetails(taskId, { ...fallback, ...updates });
        return;
    }
    setCachedTaskDetails(taskId, { ...cached, ...updates });
}

export function invalidateTaskDetails(taskId: string): void {
    taskDetailsResource.invalidate(cacheKey(taskId));
}

export function clearTaskDetailsCache(): void {
    taskDetailsResource.clear();
}
