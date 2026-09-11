import { statGroupService } from '../api/statGroupService';
import { statService } from '../api/statService';
import { taskService } from '../api/taskService';
import { sideNavSnapshotCache } from '../cache/sideNavSnapshotCache';
import { getAuthCacheScope } from '../utils/authHeaders';
import { initializeWhiteNoiseSource } from '../whiteNoise';

const bootstrapRequests = new Map<string, Promise<void>>();

/**
 * Warms data shared by the app shell, Home, and Stats page before the user needs it.
 * Each feature remains responsible for its own cache and invalidation rules.
 */
export function warmAppData(): Promise<void> {
    const key = getAuthCacheScope();
    const pendingRequest = bootstrapRequests.get(key);
    if (pendingRequest) return pendingRequest;

    // Prime the selected source in the background. Page rendering and the
    // shared warm-up request must not depend on an uploaded audio file.
    void initializeWhiteNoiseSource();

    const request = Promise.allSettled([
        taskService.getAllMainTasks(),
        statService.prefetchLastMonth(),
        statGroupService.getGroups(),
        sideNavSnapshotCache.get(),
    ]).then(results => {
        results.forEach(result => {
            if (result.status === 'rejected') {
                console.error('Failed to warm shared app data:', result.reason);
            }
        });
    });

    bootstrapRequests.set(key, request);
    return request;
}

export function clearAppBootstrap(): void {
    bootstrapRequests.clear();
}
