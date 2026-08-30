import {
    CloseMentalThreadInput,
    MentalThread,
    MentalThreadInput,
    MentalThreadLoadEntry,
    MentalThreadSummary,
} from '../../types/MentalThread.ts';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders.ts';
import { CachedResource } from '../cache/ttlCache.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const MENTAL_THREADS_URL = `${API_BASE_URL}/api/v1/mental-threads`;
const MENTAL_THREADS_TTL_MS = 30 * 1000;
const MENTAL_SUMMARY_TTL_MS = 30 * 1000;
const threadsCache = new CachedResource<MentalThread[]>({ ttlMs: MENTAL_THREADS_TTL_MS, maxEntries: 4 });
const summaryCache = new CachedResource<MentalThreadSummary>({ ttlMs: MENTAL_SUMMARY_TTL_MS, maxEntries: 4 });

function threadsCacheKey(includeClosed: boolean): string {
    return `${getAuthCacheScope()}:threads:${includeClosed}`;
}

function summaryCacheKey(): string {
    return `${getAuthCacheScope()}:summary`;
}

function invalidateReadCaches(): void {
    threadsCache.clear();
    summaryCache.clear();
}

function jsonHeaders() {
    return {
        'Content-Type': 'application/json; charset=UTF-8',
        ...getAuthHeaders(),
    };
}

async function responseJson<T>(response: Response, fallbackMessage: string): Promise<T> {
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || fallbackMessage);
    }
    return response.json() as Promise<T>;
}

export const mentalThreadService = {
    // Cached reads must outlive an individual component mount so Strict Mode cleanup cannot abort the shared request.
    async getThreads(includeClosed = false): Promise<MentalThread[]> {
        return threadsCache.get(threadsCacheKey(includeClosed), async () => {
            const response = await fetch(`${MENTAL_THREADS_URL}?includeClosed=${includeClosed}`, {
                headers: getAuthHeaders(),
            });
            return responseJson(response, 'Failed to load mental threads');
        });
    },

    async getSummary(): Promise<MentalThreadSummary> {
        return summaryCache.get(summaryCacheKey(), async () => {
            const response = await fetch(`${MENTAL_THREADS_URL}/summary`, {
                headers: getAuthHeaders(),
            });
            return responseJson(response, 'Failed to load the mental load summary');
        });
    },

    async createThread(input: MentalThreadInput): Promise<MentalThread> {
        const response = await fetch(MENTAL_THREADS_URL, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        const result = await responseJson<MentalThread>(response, 'Failed to create the mental thread');
        invalidateReadCaches();
        return result;
    },

    async updateThread(threadId: string, input: MentalThreadInput): Promise<MentalThread> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}`, {
            method: 'PUT',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        const result = await responseJson<MentalThread>(response, 'Failed to update the mental thread');
        invalidateReadCaches();
        return result;
    },

    async closeThread(threadId: string, input: CloseMentalThreadInput): Promise<MentalThread> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}/close`, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        const result = await responseJson<MentalThread>(response, 'Failed to close the mental thread');
        invalidateReadCaches();
        return result;
    },

    async reopenThread(threadId: string): Promise<MentalThread> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}/reopen`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        const result = await responseJson<MentalThread>(response, 'Failed to reopen the mental thread');
        invalidateReadCaches();
        return result;
    },

    async deleteThread(threadId: string): Promise<void> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete the mental thread');
        invalidateReadCaches();
    },

    async getLoadHistory(threadId: string, signal?: AbortSignal): Promise<MentalThreadLoadEntry[]> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}/load-history`, {
            headers: getAuthHeaders(),
            signal,
        });
        return responseJson(response, 'Failed to load mental load history');
    },

    async checkInCapacity(capacity: number): Promise<void> {
        const response = await fetch(`${MENTAL_THREADS_URL}/capacity/today`, {
            method: 'PUT',
            headers: jsonHeaders(),
            body: JSON.stringify({ capacity }),
        });
        if (!response.ok) throw new Error('Failed to save today\'s capacity');
        summaryCache.invalidate(summaryCacheKey());
    },

    clearCache(): void {
        invalidateReadCaches();
    },
};
