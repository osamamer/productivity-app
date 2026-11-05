import { statGroupService } from '../api/statGroupService';
import { sideNavSnapshotCache } from '../cache/sideNavSnapshotCache';
import { getAuthCacheScope } from '../utils/authHeaders';
import { initializeWhiteNoiseSource } from '../whiteNoise';
import { userService } from '../api/userService';

const bootstrapRequests = new Map<string, Promise<void>>();

export function hydrateCachedUserPreferences(): boolean {
    return userService.hydrateCachedPreferences();
}

export async function loadUserPreferences(): Promise<void> {
    await userService.getPreferences();
}

/**
 * Warms data shared by the app shell before the user needs it.
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
        loadUserPreferences(),
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
