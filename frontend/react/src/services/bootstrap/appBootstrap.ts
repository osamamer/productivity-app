import { statGroupService } from '../api/statGroupService';
import { statService } from '../api/statService';
import { sideNavSnapshotCache } from '../cache/sideNavSnapshotCache';
import { getAuthCacheScope } from '../utils/authHeaders';

const bootstrapRequests = new Map<string, Promise<void>>();

/**
 * Warms data shared by the app shell and Stats page before the user needs it.
 * Each feature remains responsible for its own cache and invalidation rules.
 */
export function warmAppData(): Promise<void> {
    const key = getAuthCacheScope();
    const pendingRequest = bootstrapRequests.get(key);
    if (pendingRequest) return pendingRequest;

    const request = Promise.allSettled([
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
