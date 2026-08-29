import { StatDefinition, StatEntry, StatSummary, StatInsights, CreateDefinitionRequest, RecordEntryRequest } from '../../types/Stats';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const STATS_URL = `${API_BASE_URL}/api/v1/stats`;

const entryCache = new Map<string, StatEntry[]>();
const entryRequests = new Map<string, Promise<StatEntry[]>>();
const summaryCache = new Map<string, StatSummary>();
const summaryRequests = new Map<string, Promise<StatSummary>>();
const insightsCache = new Map<string, StatInsights>();
const insightsRequests = new Map<string, Promise<StatInsights>>();
let definitionsCache: StatDefinition[] | null = null;
let definitionsRequest: Promise<StatDefinition[]> | null = null;

function entryCacheKey(definitionId: string, from: string, to: string): string {
    return `${definitionId}:${from}:${to}`;
}

function summaryCacheKey(definitionId: string, from: string, to: string): string {
    return `${definitionId}:${from}:${to}`;
}

function insightsCacheKey(definitionId: string, from: string, to: string): string {
    return `${definitionId}:${from}:${to}`;
}

function invalidateEntryCache(definitionId?: string): void {
    if (!definitionId) {
        entryCache.clear();
        return;
    }

    for (const key of entryCache.keys()) {
        if (key.startsWith(`${definitionId}:`)) entryCache.delete(key);
    }
}

function invalidateDefinitionsCache(): void {
    definitionsCache = null;
    insightsCache.clear();
}

function invalidateSummaryCache(definitionId: string): void {
    const prefix = `${definitionId}:`;
    for (const key of summaryCache.keys()) {
        if (key.startsWith(prefix)) summaryCache.delete(key);
    }
}

function invalidateInsightsCache(): void {
    insightsCache.clear();
}

function cacheRecordedEntry(entry: StatEntry): void {
    const prefix = `${entry.statDefinitionId}:`;
    for (const [key, entries] of entryCache.entries()) {
        if (!key.startsWith(prefix)) continue;
        const [from, to] = key.slice(prefix.length).split(':');
        if (entry.date < from || entry.date > to) continue;

        const updatedEntries = entries.filter(cachedEntry => cachedEntry.date !== entry.date);
        updatedEntries.push(entry);
        updatedEntries.sort((left, right) => left.date.localeCompare(right.date));
        entryCache.set(key, updatedEntries);
    }
}

export const statService = {
    async getDefinitions(): Promise<StatDefinition[]> {
        if (definitionsCache) return definitionsCache;
        if (definitionsRequest) return definitionsRequest;

        const request = fetch(`${STATS_URL}/definitions`, { headers: getAuthHeaders() })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat definitions');
                return response.json() as Promise<StatDefinition[]>;
            })
            .then(definitions => {
                definitionsCache = definitions;
                return definitions;
            });

        definitionsRequest = request;
        try {
            return await request;
        } finally {
            if (definitionsRequest === request) definitionsRequest = null;
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
                entryCache.set(key, entries);
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
        const response = await fetch(`${STATS_URL}/entries/today`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error("Failed to fetch today's entries");
        return response.json();
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
                summaryCache.set(key, summary);
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
        entryCache.clear();
        summaryCache.clear();
        insightsCache.clear();
        entryRequests.clear();
        summaryRequests.clear();
        insightsRequests.clear();
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
                insightsCache.set(key, insights);
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
        const response = await fetch(`${STATS_URL}/entries/by-date?date=${date}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error(`Failed to fetch entries for ${date}`);
        return response.json();
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
        cacheRecordedEntry(entry);
        invalidateSummaryCache(req.statDefinitionId);
        invalidateInsightsCache();
        return entry;
    },
};
