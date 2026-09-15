import { statGroupService } from '../api/statGroupService';
import { statService } from '../api/statService';
import { sideNavSnapshotCache } from '../cache/sideNavSnapshotCache';
import { getAuthCacheScope } from '../utils/authHeaders';
import { initializeWhiteNoiseSource } from '../whiteNoise';
import { userService } from '../api/userService';

const bootstrapRequests = new Map<string, Promise<void>>();

export async function loadUserPreferences(): Promise<void> {
    try {
        await userService.getPreferences();
    } catch (error) {
        // Preferences are optional at startup; each settings surface still has safe defaults.
        console.error('Failed to load user preferences:', error);
    }
}

/**
 * Warms data shared by the app shell and Stats page before the user needs it.
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
