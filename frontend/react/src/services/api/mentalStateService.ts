import { apiFetch } from '../utils/apiFetch';
import { MentalStateCheckIn, MentalStateCheckInRequest } from '../../types/MentalState';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const MENTAL_STATE_URL = `${API_BASE_URL}/api/v1/mental-state/check-ins`;
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const historyCache = new CachedResource<MentalStateCheckIn[]>({ ttlMs: HISTORY_TTL_MS, maxEntries: 8 });
const historyLimits = [1, 30, 40];

function historyKey(limit: number): string {
    return `${getAuthCacheScope()}:mental-state-history:${limit}`;
}

function updateCachedHistory(update: (history: MentalStateCheckIn[], limit: number) => MentalStateCheckIn[]): void {
    historyLimits.forEach(limit => {
        const key = historyKey(limit);
        const cached = historyCache.getStale(key);
        if (cached) historyCache.set(key, update(cached, limit));
        else historyCache.invalidate(key);
    });
}

export const mentalStateService = {
    async getHistory(limit = 30): Promise<MentalStateCheckIn[]> {
        return historyCache.get(historyKey(limit), async () => {
            const response = await apiFetch(`${MENTAL_STATE_URL}?limit=${limit}`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch mental state history');
            return response.json() as Promise<MentalStateCheckIn[]>;
        });
    },

    getCachedHistory(limit = 30): MentalStateCheckIn[] | undefined {
        return historyCache.getStale(historyKey(limit));
    },

    async checkIn(request: MentalStateCheckInRequest): Promise<MentalStateCheckIn> {
        const response = await apiFetch(MENTAL_STATE_URL, {
            method: 'POST',
            body: JSON.stringify(request),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to record mental state check-in');
        const checkIn = await response.json() as MentalStateCheckIn;
        updateCachedHistory((history, limit) => [checkIn, ...history.filter(item => item.id !== checkIn.id)].slice(0, limit));
        return checkIn;
    },

    async deleteCheckIn(checkInId: string): Promise<void> {
        const response = await apiFetch(`${MENTAL_STATE_URL}/${encodeURIComponent(checkInId)}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete mental state check-in');
        updateCachedHistory(history => history.filter(item => item.id !== checkInId));
    },

    clearCache(): void {
        historyCache.clear();
    },
};
