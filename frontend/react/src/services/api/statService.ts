import { StatBootstrapResponse, StatDefinition, StatEntry, StatEntryStatus, StatSummary, StatInsights, StatFocusTimeEntry, CreateDefinitionRequest, RecordEntryRequest, UpdateDefinitionRequest, StatRecurringTaskDraft } from '../../types/Stats';
import { TaskSeries } from '../../types/TaskSeries';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource, TtlCache } from '../cache/ttlCache';
import { invalidateResource } from '../cache/resourceInvalidation';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const STATS_URL = `${API_BASE_URL}/api/v1/stats`;
const STAT_BOOTSTRAP_URL = `${STATS_URL}/bootstrap`;

// Definitions are invalidated after create/update/delete/reorder operations, so they
// do not need to expire while the user is simply moving around the app.
const STAT_DEFINITIONS_TTL_MS = 24 * 60 * 60 * 1000;
// Stat writes invalidate affected data explicitly, so current-period data can stay warm
// for the session instead of refetching every minute while the user changes selection.
const CURRENT_STAT_DATA_TTL_MS = 24 * 60 * 60 * 1000;
const HISTORICAL_STAT_ENTRIES_TTL_MS = 30 * 60 * 1000;
const DERIVED_STAT_DATA_TTL_MS = 5 * 60 * 1000;
const STAT_CACHE_MAX_ENTRIES = 100;

const entryCache = new TtlCache<StatEntry[]>({ ttlMs: HISTORICAL_STAT_ENTRIES_TTL_MS, maxEntries: STAT_CACHE_MAX_ENTRIES });
const entryRequests = new Map<string, Promise<StatEntry[]>>();
const focusTimeCache = new TtlCache<StatFocusTimeEntry[]>({ ttlMs: DERIVED_STAT_DATA_TTL_MS, maxEntries: STAT_CACHE_MAX_ENTRIES });
const focusTimeRequests = new Map<string, Promise<StatFocusTimeEntry[]>>();
const summaryCache = new TtlCache<StatSummary>({ ttlMs: DERIVED_STAT_DATA_TTL_MS, maxEntries: STAT_CACHE_MAX_ENTRIES });
const summaryRequests = new Map<string, Promise<StatSummary>>();
const insightsCache = new TtlCache<StatInsights>({ ttlMs: DERIVED_STAT_DATA_TTL_MS, maxEntries: STAT_CACHE_MAX_ENTRIES });
const insightsRequests = new Map<string, Promise<StatInsights>>();
const dailyEntriesCache = new CachedResource<StatEntry[]>({
    ttlMs: DERIVED_STAT_DATA_TTL_MS,
    maxEntries: STAT_CACHE_MAX_ENTRIES,
});
const definitionsCache = new TtlCache<StatDefinition[]>({ ttlMs: STAT_DEFINITIONS_TTL_MS, maxEntries: 10 });
const definitionsRequests = new Map<string, Promise<StatDefinition[]>>();
const lastMonthPrefetchRequests = new Map<string, Promise<void>>();
type OptimisticEntryOverride = {
    value: number | null;
    status: StatEntryStatus;
    sequence: number;
};

type OptimisticWrite = {
    sequence: number;
    previous: Map<string, OptimisticEntryOverride | undefined>;
};

const knownEntries = new Map<string, StatEntry>();
const optimisticEntryOverrides = new Map<string, OptimisticEntryOverride>();
let optimisticWriteSequence = 0;
let statCacheGeneration = 0;

function invalidateRecurringTaskResources(): void {
    invalidateResource('stats');
    invalidateResource('tasks');
}

function definitionsCacheKey(): string {
    return `${getAuthCacheScope()}:definitions`;
}

function definitionCachePrefix(definitionId: string): string {
    return `${getAuthCacheScope()}:${definitionId}:`;
}

function entryCacheKey(definitionId: string, from: string, to: string): string {
    return `${getAuthCacheScope()}:${definitionId}:${from}:${to}`;
}

function summaryCacheKey(definitionId: string, from: string, to: string): string {
    return `${getAuthCacheScope()}:${definitionId}:${from}:${to}`;
}

function focusTimeCacheKey(definitionId: string, from: string, to: string): string {
    return `${getAuthCacheScope()}:focus-time:${definitionId}:${from}:${to}`;
}

function insightsCacheKey(definitionId: string, from: string, to: string): string {
    return `${getAuthCacheScope()}:${definitionId}:${from}:${to}`;
}

function isCurrentOrFutureRange(to: string): boolean {
    const now = new Date();
    const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('-');
    return to >= today;
}

function localDateString(date = new Date()): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function shiftLocalDate(date: string, days: number): string {
    const shifted = new Date(`${date}T12:00:00`);
    shifted.setDate(shifted.getDate() + days);
    return localDateString(shifted);
}

export interface StatDateRange {
    from: string;
    to: string;
}

export function getLastMonthWindow(today = new Date()): StatDateRange {
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 29);
    return {
        from: localDateString(fromDate),
        to: localDateString(today),
    };
}

function dailyEntriesCacheKey(date: string): string {
    return `${getAuthCacheScope()}:daily:${date}`;
}

function entryIdentity(definitionId: string, date: string): string {
    return `${getAuthCacheScope()}:${definitionId}:${date}`;
}

function rememberEntries(entries: StatEntry[]): void {
    entries.forEach(entry => knownEntries.set(entryIdentity(entry.statDefinitionId, entry.date), entry));
}

function cachedDefinition(systemKey: string): StatDefinition | undefined {
    return definitionsCache.get(definitionsCacheKey())
        ?.find(definition => definition.systemKey === systemKey);
}

function effectiveEntry(definitionId: string, date: string): StatEntry | null {
    const key = entryIdentity(definitionId, date);
    const override = optimisticEntryOverrides.get(key);
    if (override) {
        if (override.value === null) return null;
        const existing = knownEntries.get(key);
        return {
            ...(existing ?? {}),
            id: existing?.id ?? `optimistic-${definitionId}-${date}`,
            statDefinitionId: definitionId,
            statDefinition: existing?.statDefinition
                ?? definitionsCache.get(definitionsCacheKey())?.find(definition => definition.id === definitionId)
                ?? ({} as StatDefinition),
            date,
            value: override.value,
            status: override.status,
            userId: existing?.userId ?? '',
        };
    }
    return knownEntries.get(key) ?? null;
}

function applyOptimisticOverrides(
    entries: StatEntry[],
    from: string,
    to: string,
    definitionId?: string,
): StatEntry[] {
    rememberEntries(entries);
    const result = new Map(entries.map(entry => [entryIdentity(entry.statDefinitionId, entry.date), entry]));
    optimisticEntryOverrides.forEach((override, key) => {
        const parts = key.split(':');
        const date = parts.pop();
        const overrideDefinitionId = parts.pop();
        if (!date || !overrideDefinitionId || (definitionId && overrideDefinitionId !== definitionId)
            || date < from || date > to) return;

        if (override.value === null) {
            result.delete(key);
            return;
        }
        const existing = result.get(key) ?? effectiveEntry(overrideDefinitionId, date);
        result.set(key, {
            ...(existing ?? {}),
            id: existing?.id ?? `optimistic-${overrideDefinitionId}-${date}`,
            statDefinitionId: overrideDefinitionId,
            statDefinition: existing?.statDefinition
                ?? definitionsCache.get(definitionsCacheKey())?.find(item => item.id === overrideDefinitionId)
                ?? ({} as StatDefinition),
            date,
            value: override.value,
            status: override.status,
            userId: existing?.userId ?? '',
        });
    });
    return Array.from(result.values());
}

function setOptimisticOverride(
    key: string,
    value: number | null,
    status: StatEntryStatus,
    sequence: number,
    previous: Map<string, OptimisticEntryOverride | undefined>,
): void {
    if (!previous.has(key)) previous.set(key, optimisticEntryOverrides.get(key));
    optimisticEntryOverrides.set(key, { value, status, sequence });
}

function applyOptimisticRecord(req: RecordEntryRequest): OptimisticWrite {
    const sequence = ++optimisticWriteSequence;
    const previous = new Map<string, OptimisticEntryOverride | undefined>();
    const date = req.date ?? localDateString();
    const status = req.status ?? 'RECORDED';
    const value = status === 'NOT_PLANNED' ? 0 : req.value;
    const changedKey = entryIdentity(req.statDefinitionId, date);
    setOptimisticOverride(changedKey, value, status, sequence, previous);

    const definition = definitionsCache.get(definitionsCacheKey())
        ?.find(item => item.id === req.statDefinitionId);
    const systemKey = definition?.systemKey;
    if (systemKey === 'sleep_time' || systemKey === 'wake_up_time') {
        const sleepDate = systemKey === 'sleep_time'
            ? date
            : shiftLocalDate(date, -1);
        const wakeUpDate = shiftLocalDate(sleepDate, 1);
        const sleepDefinition = cachedDefinition('sleep_time');
        const wakeUpDefinition = cachedDefinition('wake_up_time');
        const durationDefinition = cachedDefinition('sleep_hours');
        if (sleepDefinition && wakeUpDefinition && durationDefinition) {
            const sleepEntry = effectiveEntry(sleepDefinition.id, sleepDate);
            const wakeUpEntry = effectiveEntry(wakeUpDefinition.id, wakeUpDate);
            const durationKey = entryIdentity(durationDefinition.id, wakeUpDate);
            if (sleepEntry && wakeUpEntry) {
                let durationMinutes = Math.round(wakeUpEntry.value) - Math.round(sleepEntry.value);
                if (durationMinutes <= 0) durationMinutes += 24 * 60;
                setOptimisticOverride(
                    durationKey, durationMinutes, 'RECORDED', sequence, previous,
                );
            }
        }
    }

    return { sequence, previous };
}

function clearOptimisticWrite(write: OptimisticWrite, rollback: boolean): void {
    write.previous.forEach((oldValue, key) => {
        const current = optimisticEntryOverrides.get(key);
        if (!current || current.sequence !== write.sequence) return;
        if (rollback && oldValue) optimisticEntryOverrides.set(key, oldValue);
        else if (rollback) optimisticEntryOverrides.delete(key);
        else optimisticEntryOverrides.delete(key);
    });
}

function invalidateEntryCache(definitionId?: string): void {
    statCacheGeneration += 1;
    if (!definitionId) {
        entryCache.clear();
        return;
    }

    entryCache.deleteMatching(key => key.startsWith(definitionCachePrefix(definitionId)));
}

function invalidateDefinitionsCache(): void {
    statCacheGeneration += 1;
    definitionsCache.delete(definitionsCacheKey());
    focusTimeCache.clear();
    focusTimeRequests.clear();
    insightsCache.clear();
}

function invalidateSummaryCache(definitionId: string): void {
    statCacheGeneration += 1;
    summaryCache.deleteMatching(key => key.startsWith(definitionCachePrefix(definitionId)));
}

function invalidateInsightsCache(): void {
    statCacheGeneration += 1;
    insightsCache.clear();
}

function clearDataCaches(): void {
    statCacheGeneration += 1;
    entryCache.clear();
    focusTimeCache.clear();
    summaryCache.clear();
    insightsCache.clear();
    entryRequests.clear();
    focusTimeRequests.clear();
    summaryRequests.clear();
    insightsRequests.clear();
    dailyEntriesCache.clear();
    lastMonthPrefetchRequests.clear();
}

export const statService = {
    async getDefinitions(): Promise<StatDefinition[]> {
        const key = definitionsCacheKey();
        const cachedDefinitions = definitionsCache.get(key);
        if (cachedDefinitions) return cachedDefinitions;

        const pendingRequest = definitionsRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const request = fetch(`${STATS_URL}/definitions`, { headers: getAuthHeaders() })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat definitions');
                return response.json() as Promise<StatDefinition[]>;
            })
            .then(definitions => {
                definitionsCache.set(key, definitions);
                return definitions;
            });

        definitionsRequests.set(key, request);
        try {
            return await request;
        } finally {
            if (definitionsRequests.get(key) === request) definitionsRequests.delete(key);
        }
    },

    async prefetchLastMonth(): Promise<void> {
        const range = getLastMonthWindow();
        const key = `${getAuthCacheScope()}:${range.from}:${range.to}`;
        const pendingRequest = lastMonthPrefetchRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const requestGeneration = statCacheGeneration;
        const request = (async () => {
            const params = new URLSearchParams({ from: range.from, to: range.to });
            const response = await fetch(`${STAT_BOOTSTRAP_URL}?${params}`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to warm statistics');

            const bootstrap = await response.json() as StatBootstrapResponse;
            if (requestGeneration !== statCacheGeneration) return;

            definitionsCache.set(definitionsCacheKey(), bootstrap.definitions);
            bootstrap.definitions.forEach(definition => {
                const entries = bootstrap.entries[definition.id] ?? [];
                rememberEntries(entries);
                entryCache.set(
                    entryCacheKey(definition.id, range.from, range.to),
                    entries,
                    CURRENT_STAT_DATA_TTL_MS,
                );
                const summary = bootstrap.summaries[definition.id];
                if (summary) {
                    summaryCache.set(
                        summaryCacheKey(definition.id, range.from, range.to),
                        summary,
                        CURRENT_STAT_DATA_TTL_MS,
                    );
                }
            });
        })();

        lastMonthPrefetchRequests.set(key, request);
        try {
            await request;
        } finally {
            if (lastMonthPrefetchRequests.get(key) === request) {
                lastMonthPrefetchRequests.delete(key);
            }
        }
    },

    async createDefinition(req: CreateDefinitionRequest): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions`, {
            method: 'POST',
            body: JSON.stringify(req),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to create stat definition');
        const definition = await response.json() as StatDefinition;
        invalidateDefinitionsCache();
        if (req.createRecurringTask) invalidateRecurringTaskResources();
        return definition;
    },

    async deleteDefinition(id: string): Promise<void> {
        const response = await fetch(`${STATS_URL}/definitions/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete stat definition');
        invalidateDefinitionsCache();
        invalidateEntryCache(id);
        invalidateSummaryCache(id);
        invalidateInsightsCache();
    },

    async updateDefinition(id: string, req: UpdateDefinitionRequest): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(req),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to update stat definition');
        invalidateDefinitionsCache();
        invalidateEntryCache(id);
        invalidateSummaryCache(id);
        invalidateInsightsCache();
        return response.json();
    },

    async createRecurringTask(definitionId: string, recurrence: StatRecurringTaskDraft): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/recurring-task`, {
            method: 'POST',
            body: JSON.stringify({
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                recurrenceFrequency: recurrence.recurrenceFrequency,
                recurrenceDaysOfWeek: recurrence.recurrenceDaysOfWeek,
                timeOfDay: recurrence.timeOfDay,
                importance: recurrence.importance,
                taskName: recurrence.taskName,
            }),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to create recurring task');
        invalidateDefinitionsCache();
        invalidateRecurringTaskResources();
        return response.json();
    },

    async getRecurringTask(definitionId: string): Promise<TaskSeries> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/recurring-task`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch recurring task');
        return response.json();
    },

    async updateRecurringTask(definitionId: string, recurrence: StatRecurringTaskDraft): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/recurring-task`, {
            method: 'PUT',
            body: JSON.stringify({
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                recurrenceFrequency: recurrence.recurrenceFrequency,
                recurrenceDaysOfWeek: recurrence.recurrenceDaysOfWeek,
                timeOfDay: recurrence.timeOfDay,
                importance: recurrence.importance,
            }),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to update recurring task');
        invalidateDefinitionsCache();
        invalidateRecurringTaskResources();
        return response.json();
    },

    async deleteRecurringTaskSeries(definitionId: string): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/recurring-task/series`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete recurring task series');
        invalidateDefinitionsCache();
        invalidateRecurringTaskResources();
        return response.json();
    },

    async disconnectRecurringTask(definitionId: string): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/recurring-task`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to disconnect recurring task');
        invalidateDefinitionsCache();
        invalidateResource('stats');
        return response.json();
    },

    async linkFocusTask(definitionId: string, taskName: string): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/focus-task`, {
            method: 'PUT',
            body: JSON.stringify({ taskName }),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to link task focus time');
        invalidateDefinitionsCache();
        invalidateResource('stats');
        return response.json();
    },

    async startFocusTask(
        definitionId: string,
        taskName: string,
        importance: number,
    ): Promise<import('../../types/Task').Task> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/focus-task/start`, {
            method: 'POST',
            body: JSON.stringify({
                taskName,
                importance,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            }),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to start focus task');
        invalidateDefinitionsCache();
        invalidateRecurringTaskResources();
        return response.json();
    },

    async unlinkFocusTask(definitionId: string, taskName?: string): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/focus-task`, {
            method: 'DELETE',
            body: taskName ? JSON.stringify({ taskName }) : undefined,
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to unlink task focus time');
        invalidateDefinitionsCache();
        invalidateResource('stats');
        return response.json();
    },

    async reorderDefinitions(definitionIds: string[]): Promise<StatDefinition[]> {
        const response = await fetch(`${STATS_URL}/definitions/order`, {
            method: 'PUT',
            body: JSON.stringify({ definitionIds }),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to reorder stat definitions');
        invalidateDefinitionsCache();
        return response.json();
    },

    async getEntries(definitionId: string, from: string, to: string): Promise<StatEntry[]> {
        const key = entryCacheKey(definitionId, from, to);
        const cachedEntries = entryCache.get(key);
        if (cachedEntries) return applyOptimisticOverrides(cachedEntries, from, to, definitionId);

        const pendingRequest = entryRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const requestGeneration = statCacheGeneration;
        const params = new URLSearchParams({ statDefinitionId: definitionId, from, to });
        const request = fetch(`${STATS_URL}/entries?${params}`, { headers: getAuthHeaders() })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat entries');
                return response.json() as Promise<StatEntry[]>;
            })
            .then(entries => {
                rememberEntries(entries);
                if (requestGeneration === statCacheGeneration) {
                    entryCache.set(
                        key,
                        entries,
                        isCurrentOrFutureRange(to) ? CURRENT_STAT_DATA_TTL_MS : HISTORICAL_STAT_ENTRIES_TTL_MS,
                    );
                }
                return applyOptimisticOverrides(entries, from, to, definitionId);
            });

        entryRequests.set(key, request);
        try {
            return await request;
        } finally {
            if (entryRequests.get(key) === request) entryRequests.delete(key);
        }
    },

    getCachedEntries(definitionId: string, from: string, to: string): StatEntry[] | undefined {
        const entries = entryCache.getStale(entryCacheKey(definitionId, from, to));
        return entries ? applyOptimisticOverrides(entries, from, to, definitionId) : undefined;
    },

    async getFocusTime(definitionId: string, from: string, to: string): Promise<StatFocusTimeEntry[]> {
        const key = focusTimeCacheKey(definitionId, from, to);
        const cachedFocusTime = focusTimeCache.get(key);
        if (cachedFocusTime) return cachedFocusTime;

        const pendingRequest = focusTimeRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const requestGeneration = statCacheGeneration;
        const params = new URLSearchParams({ from, to });
        const request = fetch(`${STATS_URL}/definitions/${definitionId}/focus-time?${params}`, {
            headers: getAuthHeaders(),
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch task focus time');
                return response.json() as Promise<StatFocusTimeEntry[]>;
            })
            .then(entries => {
                if (requestGeneration === statCacheGeneration) {
                    focusTimeCache.set(
                        key,
                        entries,
                        isCurrentOrFutureRange(to) ? CURRENT_STAT_DATA_TTL_MS : DERIVED_STAT_DATA_TTL_MS,
                    );
                }
                return entries;
            });

        focusTimeRequests.set(key, request);
        try {
            return await request;
        } finally {
            if (focusTimeRequests.get(key) === request) focusTimeRequests.delete(key);
        }
    },

    getCachedFocusTime(definitionId: string, from: string, to: string): StatFocusTimeEntry[] | undefined {
        return focusTimeCache.getStale(focusTimeCacheKey(definitionId, from, to));
    },

    async getTodayEntries(): Promise<StatEntry[]> {
        const date = localDateString();
        const entries = await dailyEntriesCache.get(dailyEntriesCacheKey(date), async () => {
            const response = await fetch(`${STATS_URL}/entries/today`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error("Failed to fetch today's entries");
            return response.json();
        }, CURRENT_STAT_DATA_TTL_MS);
        return applyOptimisticOverrides(entries, date, date);
    },

    async getSummary(definitionId: string, from: string, to: string): Promise<StatSummary> {
        const key = summaryCacheKey(definitionId, from, to);
        const cachedSummary = summaryCache.get(key);
        if (cachedSummary) return cachedSummary;

        const pendingRequest = summaryRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const requestGeneration = statCacheGeneration;
        const params = new URLSearchParams({ from, to });
        const request = fetch(`${STATS_URL}/definitions/${definitionId}/summary?${params}`, {
            headers: getAuthHeaders(),
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat summary');
                return response.json() as Promise<StatSummary>;
            })
            .then(summary => {
                if (requestGeneration === statCacheGeneration) {
                    summaryCache.set(
                        key,
                        summary,
                        isCurrentOrFutureRange(to) ? CURRENT_STAT_DATA_TTL_MS : DERIVED_STAT_DATA_TTL_MS,
                    );
                }
                return summary;
            });

        summaryRequests.set(key, request);
        try {
            return await request;
        } finally {
            if (summaryRequests.get(key) === request) summaryRequests.delete(key);
        }
    },

    getCachedSummary(definitionId: string, from: string, to: string): StatSummary | undefined {
        return summaryCache.getStale(summaryCacheKey(definitionId, from, to));
    },

    clearSummaryCache(): void {
        summaryCache.clear();
    },

    clearDataCache(): void {
        clearDataCaches();
    },

    clearCache(): void {
        definitionsCache.clear();
        definitionsRequests.clear();
        lastMonthPrefetchRequests.clear();
        knownEntries.clear();
        optimisticEntryOverrides.clear();
        clearDataCaches();
    },

    async getInsights(definitionId: string, from: string, to: string): Promise<StatInsights> {
        const key = insightsCacheKey(definitionId, from, to);
        const cachedInsights = insightsCache.get(key);
        if (cachedInsights) return cachedInsights;

        const pendingRequest = insightsRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const requestGeneration = statCacheGeneration;
        const params = new URLSearchParams({ from, to });
        const request = fetch(`${STATS_URL}/definitions/${definitionId}/insights?${params}`, {
            headers: getAuthHeaders(),
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat insights');
                return response.json() as Promise<StatInsights>;
            })
            .then(insights => {
                if (requestGeneration === statCacheGeneration) {
                    insightsCache.set(
                        key,
                        insights,
                        isCurrentOrFutureRange(to) ? CURRENT_STAT_DATA_TTL_MS : DERIVED_STAT_DATA_TTL_MS,
                    );
                }
                return insights;
            });

        insightsRequests.set(key, request);
        try {
            return await request;
        } finally {
            if (insightsRequests.get(key) === request) insightsRequests.delete(key);
        }
    },

    async getEntriesByDate(date: string): Promise<StatEntry[]> {
        const entries = await dailyEntriesCache.get(dailyEntriesCacheKey(date), async () => {
            const response = await fetch(`${STATS_URL}/entries/by-date?date=${date}`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error(`Failed to fetch entries for ${date}`);
            return response.json();
        }, isCurrentOrFutureRange(date) ? CURRENT_STAT_DATA_TTL_MS : DERIVED_STAT_DATA_TTL_MS);
        return applyOptimisticOverrides(entries, date, date);
    },

    async recordEntry(req: RecordEntryRequest): Promise<StatEntry | null> {
        const optimisticWrite = applyOptimisticRecord(req);
        invalidateResource('stats');
        try {
            const response = await fetch(`${STATS_URL}/entries`, {
                method: 'POST',
                body: JSON.stringify(req),
                headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
            });
            if (!response.ok) throw new Error('Failed to record stat entry');
            const responseEntry = response.status === 204
                ? null
                : await response.json() as StatEntry | null;
            const entry = responseEntry
                ? { ...responseEntry, statDefinitionId: req.statDefinitionId }
                : null;
            clearOptimisticWrite(optimisticWrite, false);
            if (entry) knownEntries.set(entryIdentity(entry.statDefinitionId, entry.date), entry);
            else knownEntries.delete(entryIdentity(req.statDefinitionId, req.date ?? localDateString()));
            // A write can create a derived sleep-duration entry for a different definition and date.
            clearDataCaches();
            invalidateResource('stats');
            return entry;
        } catch (error) {
            clearOptimisticWrite(optimisticWrite, true);
            // Keep the pre-write entry caches on failure. They already contain
            // the persisted value, and retaining them lets every read surface
            // roll back immediately without an extra round trip.
            invalidateResource('stats');
            throw error;
        }
    },
};
