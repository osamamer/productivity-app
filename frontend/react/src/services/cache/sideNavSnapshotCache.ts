import { mentalStateService } from '../api/mentalStateService';
import { taskService } from '../api/taskService';
import { CachedResource } from './ttlCache';
import { getAuthCacheScope } from '../utils/authHeaders';

export interface TodaySnapshot {
    openTaskCount: number | null;
    focusSeconds: number | null;
    mentalState: string | null;
}

const SNAPSHOT_TTL_MS = 30_000;
const MENTAL_STATE_FRESHNESS_WINDOW_MS = 60 * 60 * 1000;
const snapshotCache = new CachedResource<TodaySnapshot>({ ttlMs: SNAPSHOT_TTL_MS, maxEntries: 4 });
const snapshotListeners = new Set<(snapshot: TodaySnapshot) => void>();

function getLocalDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function cacheKey(): string {
    return `${getAuthCacheScope()}:side-nav:${getLocalDateKey()}`;
}

function isFreshMentalState(recordedAt: string, now = Date.now()): boolean {
    const recordedAtMs = Date.parse(recordedAt);
    const ageMs = now - recordedAtMs;
    return Number.isFinite(recordedAtMs)
        && ageMs >= 0
        && ageMs <= MENTAL_STATE_FRESHNESS_WINDOW_MS;
}

async function loadSnapshot(): Promise<TodaySnapshot> {
    const [tasksResult, pomodoroResult, mentalStateResult] = await Promise.allSettled([
        taskService.getTodayTasks(),
        taskService.getTodayFocusSummary(getLocalDateKey()),
        mentalStateService.getHistory(1),
    ]);

    if (tasksResult.status === 'rejected') {
        console.error('Failed to load the drawer task summary:', tasksResult.reason);
    }
    if (pomodoroResult.status === 'rejected') {
        console.error('Failed to load the drawer focus summary:', pomodoroResult.reason);
    }
    if (mentalStateResult.status === 'rejected') {
        console.error('Failed to load the drawer mental-state summary:', mentalStateResult.reason);
    }

    const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value : null;
    const focusSummary = pomodoroResult.status === 'fulfilled' ? pomodoroResult.value : null;
    const mentalCheckIns = mentalStateResult.status === 'fulfilled' ? mentalStateResult.value : null;
    const latestMentalCheckIn = mentalCheckIns?.[0];

    return {
        openTaskCount: tasks?.filter(task => !task.completed && !task.skipped).length ?? null,
        focusSeconds: focusSummary?.totalFocusSeconds ?? null,
        mentalState: latestMentalCheckIn
            && isFreshMentalState(latestMentalCheckIn.recordedAt)
            ? latestMentalCheckIn.state
            : null,
    };
}

export const sideNavSnapshotCache = {
    getCached(): TodaySnapshot | undefined {
        return snapshotCache.getCached(cacheKey());
    },

    get(): Promise<TodaySnapshot> {
        return snapshotCache.get(cacheKey(), loadSnapshot);
    },

    updateMentalState(mentalState: string | null): void {
        const key = cacheKey();
        const current = snapshotCache.getStale(key) ?? {
            openTaskCount: null,
            focusSeconds: null,
            mentalState: null,
        };
        const snapshot = { ...current, mentalState };
        snapshotCache.set(key, snapshot);
        snapshotListeners.forEach(listener => listener(snapshot));
    },

    subscribe(listener: (snapshot: TodaySnapshot) => void): () => void {
        snapshotListeners.add(listener);
        return () => {
            snapshotListeners.delete(listener);
        };
    },

    clear(): void {
        snapshotCache.clear();
    },
};
