import { StatDefinition, StatEntry, StatSummary, CreateDefinitionRequest, RecordEntryRequest } from '../../types/Stats';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const STATS_URL = `${API_BASE_URL}/api/v1/stats`;

const entryCache = new Map<string, StatEntry[]>();
const entryRequests = new Map<string, Promise<StatEntry[]>>();
const summaryCache = new Map<string, StatSummary>();
const summaryRequests = new Map<string, Promise<StatSummary>>();
let definitionsCache: StatDefinition[] | null = null;
let definitionsRequest: Promise<StatDefinition[]> | null = null;

function entryCacheKey(definitionId: string, from: string, to: string): string {
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
        summaryCache.delete(id);
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

    async getSummary(definitionId: string): Promise<StatSummary> {
        const cachedSummary = summaryCache.get(definitionId);
        if (cachedSummary) return cachedSummary;

        const pendingRequest = summaryRequests.get(definitionId);
        if (pendingRequest) return pendingRequest;

        const request = fetch(`${STATS_URL}/definitions/${definitionId}/summary`, {
            headers: getAuthHeaders(),
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch stat summary');
                return response.json() as Promise<StatSummary>;
            })
            .then(summary => {
                summaryCache.set(definitionId, summary);
                return summary;
            });

        summaryRequests.set(definitionId, request);
        try {
            return await request;
        } finally {
            if (summaryRequests.get(definitionId) === request) summaryRequests.delete(definitionId);
        }
    },

    getCachedSummary(definitionId: string): StatSummary | undefined {
        return summaryCache.get(definitionId);
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
        const entry = await response.json() as StatEntry;
        cacheRecordedEntry(entry);
        summaryCache.delete(req.statDefinitionId);
        return entry;
    },
};
