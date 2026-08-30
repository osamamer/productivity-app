import { StatDefinition, StatEntry, StatSummary, StatInsights, CreateDefinitionRequest, RecordEntryRequest } from '../../types/Stats';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource, TtlCache } from '../cache/ttlCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const STATS_URL = `${API_BASE_URL}/api/v1/stats`;

const STAT_DEFINITIONS_TTL_MS = 10 * 60 * 1000;
const CURRENT_STAT_DATA_TTL_MS = 60 * 1000;
const HISTORICAL_STAT_ENTRIES_TTL_MS = 30 * 60 * 1000;
const DERIVED_STAT_DATA_TTL_MS = 5 * 60 * 1000;
const STAT_CACHE_MAX_ENTRIES = 100;

const entryCache = new TtlCache<StatEntry[]>({ ttlMs: HISTORICAL_STAT_ENTRIES_TTL_MS, maxEntries: STAT_CACHE_MAX_ENTRIES });
const entryRequests = new Map<string, Promise<StatEntry[]>>();
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

function dailyEntriesCacheKey(date: string): string {
    return `${getAuthCacheScope()}:daily:${date}`;
}

function invalidateEntryCache(definitionId?: string): void {
    if (!definitionId) {
        entryCache.clear();
        return;
    }

    entryCache.deleteMatching(key => key.startsWith(definitionCachePrefix(definitionId)));
}

function invalidateDefinitionsCache(): void {
    definitionsCache.delete(definitionsCacheKey());
    insightsCache.clear();
}

function invalidateSummaryCache(definitionId: string): void {
    summaryCache.deleteMatching(key => key.startsWith(definitionCachePrefix(definitionId)));
}

function invalidateInsightsCache(): void {
    insightsCache.clear();
}

function clearDataCaches(): void {
    entryCache.clear();
    summaryCache.clear();
    insightsCache.clear();
    entryRequests.clear();
    summaryRequests.clear();
    insightsRequests.clear();
    dailyEntriesCache.clear();
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

    async createDefinition(req: CreateDefinitionRequest): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions`, {
            method: 'POST',
            body: JSON.stringify(req),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to create stat definition');
        invalidateDefinitionsCache();
        return response.json();
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
        if (cachedEntries) return cachedEntries;

        const pendingRequest = entryRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const params = new URLSearchParams({ statDefinitionId: definitionId, from, to });
        const request = fetch(`${STATS_URL}/entries?${params}`, { headers: getAuthHeaders() })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat entries');
                return response.json() as Promise<StatEntry[]>;
            })
            .then(entries => {
                entryCache.set(
                    key,
                    entries,
                    isCurrentOrFutureRange(to) ? CURRENT_STAT_DATA_TTL_MS : HISTORICAL_STAT_ENTRIES_TTL_MS,
                );
                return entries;
            });

        entryRequests.set(key, request);
        try {
            return await request;
        } finally {
            if (entryRequests.get(key) === request) entryRequests.delete(key);
        }
    },

    getCachedEntries(definitionId: string, from: string, to: string): StatEntry[] | undefined {
        return entryCache.get(entryCacheKey(definitionId, from, to));
    },

    async getTodayEntries(): Promise<StatEntry[]> {
        const date = localDateString();
        return dailyEntriesCache.get(dailyEntriesCacheKey(date), async () => {
            const response = await fetch(`${STATS_URL}/entries/today`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error("Failed to fetch today's entries");
            return response.json();
        }, CURRENT_STAT_DATA_TTL_MS);
    },

    async getSummary(definitionId: string, from: string, to: string): Promise<StatSummary> {
        const key = summaryCacheKey(definitionId, from, to);
        const cachedSummary = summaryCache.get(key);
        if (cachedSummary) return cachedSummary;

        const pendingRequest = summaryRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const params = new URLSearchParams({ from, to });
        const request = fetch(`${STATS_URL}/definitions/${definitionId}/summary?${params}`, {
            headers: getAuthHeaders(),
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat summary');
                return response.json() as Promise<StatSummary>;
            })
            .then(summary => {
                summaryCache.set(
                    key,
                    summary,
                    isCurrentOrFutureRange(to) ? CURRENT_STAT_DATA_TTL_MS : DERIVED_STAT_DATA_TTL_MS,
                );
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
        return summaryCache.get(summaryCacheKey(definitionId, from, to));
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
        clearDataCaches();
    },

    async getInsights(definitionId: string, from: string, to: string): Promise<StatInsights> {
        const key = insightsCacheKey(definitionId, from, to);
        const cachedInsights = insightsCache.get(key);
        if (cachedInsights) return cachedInsights;

        const pendingRequest = insightsRequests.get(key);
        if (pendingRequest) return pendingRequest;

        const params = new URLSearchParams({ from, to });
        const request = fetch(`${STATS_URL}/definitions/${definitionId}/insights?${params}`, {
            headers: getAuthHeaders(),
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat insights');
                return response.json() as Promise<StatInsights>;
            })
            .then(insights => {
                insightsCache.set(
                    key,
                    insights,
                    isCurrentOrFutureRange(to) ? CURRENT_STAT_DATA_TTL_MS : DERIVED_STAT_DATA_TTL_MS,
                );
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
        return dailyEntriesCache.get(dailyEntriesCacheKey(date), async () => {
            const response = await fetch(`${STATS_URL}/entries/by-date?date=${date}`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error(`Failed to fetch entries for ${date}`);
            return response.json();
        }, isCurrentOrFutureRange(date) ? CURRENT_STAT_DATA_TTL_MS : DERIVED_STAT_DATA_TTL_MS);
    },

    async recordEntry(req: RecordEntryRequest): Promise<StatEntry> {
        const response = await fetch(`${STATS_URL}/entries`, {
            method: 'POST',
            body: JSON.stringify(req),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to record stat entry');
        const responseEntry = await response.json() as StatEntry;
        const entry = { ...responseEntry, statDefinitionId: req.statDefinitionId };
        // Entries, summaries, and insights are all derived from this write.
        invalidateEntryCache(req.statDefinitionId);
        if (responseEntry.date) dailyEntriesCache.invalidate(dailyEntriesCacheKey(responseEntry.date));
        invalidateSummaryCache(req.statDefinitionId);
        invalidateInsightsCache();
        return entry;
    },
};
