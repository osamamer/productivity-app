import { mentalStateService } from '../api/mentalStateService';
import { taskService } from '../api/taskService';
import { CachedResource } from './ttlCache';
import { getAuthCacheScope } from '../utils/authHeaders';
import { subscribeToResourceInvalidation } from './resourceInvalidation';

export interface TodaySnapshot {
    openTaskCount: number | null;
    focusSeconds: number | null;
    mentalState: string | null;
}

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
const MENTAL_STATE_FRESHNESS_WINDOW_MS = 60 * 60 * 1000;
const snapshotCache = new CachedResource<TodaySnapshot>({ ttlMs: SNAPSHOT_TTL_MS, maxEntries: 4 });
const snapshotListeners = new Set<(snapshot: TodaySnapshot) => void>();
let refreshRequest: Promise<TodaySnapshot> | null = null;
let refreshGeneration = 0;

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
    const [tasksResult, pomodoroResult] = await Promise.allSettled([
        taskService.getTodayTasks(),
        taskService.getTodayFocusSummary(getLocalDateKey()),
    ]);

    if (tasksResult.status === 'rejected') {
        console.error('Failed to load the drawer task summary:', tasksResult.reason);
    }
    if (pomodoroResult.status === 'rejected') {
        console.error('Failed to load the drawer focus summary:', pomodoroResult.reason);
    }

    const today = new Date();
    const tasks = tasksResult.status === 'fulfilled'
        ? tasksResult.value.filter(task => {
            if (!task.scheduledPerformDateTime) return false;
            const scheduledAt = new Date(task.scheduledPerformDateTime);
            return Number.isFinite(scheduledAt.getTime())
                && scheduledAt.getFullYear() === today.getFullYear()
                && scheduledAt.getMonth() === today.getMonth()
                && scheduledAt.getDate() === today.getDate();
        })
        : null;
    const focusSummary = pomodoroResult.status === 'fulfilled' ? pomodoroResult.value : null;
    const latestMentalCheckIn = mentalStateService.getCachedHistory(40)?.[0];

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
        const snapshot = snapshotCache.getCached(cacheKey());
        if (!snapshot) return undefined;
        const history = mentalStateService.getCachedHistory(40);
        if (!history) return snapshot;
        const latest = history[0];
        const mentalState = latest && isFreshMentalState(latest.recordedAt) ? latest.state : null;
        return mentalState === snapshot.mentalState ? snapshot : { ...snapshot, mentalState };
    },

    get(): Promise<TodaySnapshot> {
        return snapshotCache.get(cacheKey(), loadSnapshot);
    },

    refresh(force = false): Promise<TodaySnapshot> {
        if (refreshRequest && !force) return refreshRequest;
        const generation = ++refreshGeneration;
        snapshotCache.invalidate(cacheKey());
        const request = snapshotCache.get(cacheKey(), loadSnapshot).then(snapshot => {
            if (generation !== refreshGeneration) return snapshot;
            const current = this.getCached() ?? snapshot;
            snapshotListeners.forEach(listener => listener(current));
            return current;
        });
        refreshRequest = request;
        void request.finally(() => {
            if (refreshRequest === request) refreshRequest = null;
        }).catch(() => undefined);
        return request;
    },

    updateMentalState(mentalState: string | null): void {
        const key = cacheKey();
        const existing = snapshotCache.getStale(key);
        const current = existing ?? {
            openTaskCount: null,
            focusSeconds: null,
            mentalState: null,
        };
        const snapshot = { ...current, mentalState };
        snapshotCache.set(key, snapshot);
        snapshotListeners.forEach(listener => listener(snapshot));
        if (!existing) {
            void this.refresh().catch(error => {
                console.error('Failed to refresh the drawer summary after a mental-state change:', error);
            });
        }
    },

    subscribe(listener: (snapshot: TodaySnapshot) => void): () => void {
        snapshotListeners.add(listener);
        return () => {
            snapshotListeners.delete(listener);
        };
    },

    clear(): void {
        snapshotCache.clear();
        refreshRequest = null;
        refreshGeneration += 1;
    },
};

subscribeToResourceInvalidation('tasks', () => {
    void sideNavSnapshotCache.refresh(true).catch(error => {
        console.error('Failed to refresh the drawer summary after a task change:', error);
    });
});
