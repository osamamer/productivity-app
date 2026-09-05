import { Task } from '../../types/Task';
import { CachedResource } from './ttlCache';
import { getAuthCacheScope } from '../utils/authHeaders';

// Subtasks are small, user-scoped collections. Keeping them warm briefly makes
// opening task details feel immediate without retaining an unbounded snapshot.
export const TASK_SUBTASKS_TTL_MS = 60 * 1000;

const taskSubtasksResource = new CachedResource<Task[]>({
    ttlMs: TASK_SUBTASKS_TTL_MS,
    maxEntries: 500,
});

function cacheKey(taskId: string): string {
    return `${getAuthCacheScope()}:${taskId}`;
}

export function getCachedTaskSubtasks(taskId: string): Task[] | undefined {
    return taskSubtasksResource.getCached(cacheKey(taskId));
}

export function getStaleTaskSubtasks(taskId: string): Task[] | undefined {
    return taskSubtasksResource.getStale(cacheKey(taskId));
}

export function loadTaskSubtasks(
    taskId: string,
    loader: () => Promise<Task[]>,
    forceRefresh = false,
): Promise<Task[]> {
    const key = cacheKey(taskId);
    if (forceRefresh) taskSubtasksResource.invalidate(key);
    return taskSubtasksResource.get(key, loader, TASK_SUBTASKS_TTL_MS);
}

export function setCachedTaskSubtasks(taskId: string, subtasks: Task[]): void {
    taskSubtasksResource.set(cacheKey(taskId), subtasks, TASK_SUBTASKS_TTL_MS);
}

export function invalidateTaskSubtasks(taskId: string): void {
    taskSubtasksResource.invalidate(cacheKey(taskId));
}

export function clearTaskSubtasksCache(): void {
    taskSubtasksResource.clear();
}
