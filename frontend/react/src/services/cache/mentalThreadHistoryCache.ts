import { MentalThreadLoadEntry } from '../../types/MentalThread.ts';
import { getAuthCacheScope } from '../utils/authHeaders.ts';
import { TtlCache } from './ttlCache.ts';

export interface CachedMentalThreadHistory {
    mentalLoad: number;
    updatedAt: string;
    entries: MentalThreadLoadEntry[];
}

const LOAD_HISTORY_TTL_MS = 5 * 60 * 1000;
const LOAD_HISTORY_MAX_ENTRIES = 100;
const loadHistoryCache = new TtlCache<CachedMentalThreadHistory>({
    ttlMs: LOAD_HISTORY_TTL_MS,
    maxEntries: LOAD_HISTORY_MAX_ENTRIES,
});

function cacheKey(threadId: string): string {
    return `${getAuthCacheScope()}:${threadId}`;
}

export function getCachedMentalThreadHistory(threadId: string): CachedMentalThreadHistory | undefined {
    return loadHistoryCache.get(cacheKey(threadId));
}

export function cacheMentalThreadHistory(threadId: string, history: CachedMentalThreadHistory): void {
    loadHistoryCache.set(cacheKey(threadId), history);
}

export function invalidateMentalThreadHistory(threadId: string): void {
    loadHistoryCache.delete(cacheKey(threadId));
}

export function clearMentalThreadHistoryCache(): void {
    loadHistoryCache.clear();
}
