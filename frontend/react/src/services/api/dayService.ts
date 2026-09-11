// src/services/api/dayService.ts
import { DayCalendarEntry, DayEntity } from '../../types/DayEntity';
import { DayOverview } from '../../types/DayOverview';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const DAY_URL = `${API_BASE_URL}/api/v1/day`;
const TODAY_TTL_MS = 60 * 1000;
const todayCache = new CachedResource<DayEntity>({ ttlMs: TODAY_TTL_MS, maxEntries: 4 });

function todayCacheKey(): string {
    return `${getAuthCacheScope()}:today`;
}

export const dayService = {

    async getOverview(date: string, signal?: AbortSignal): Promise<DayOverview> {
        const response = await fetch(`${DAY_URL}/overview/${encodeURIComponent(date)}`, {
            headers: getAuthHeaders(),
            signal,
        });
        if (!response.ok) {
            throw new Error('Failed to fetch day overview');
        }
        return response.json();
    },

    async getToday(): Promise<DayEntity> {
        return todayCache.get(todayCacheKey(), async () => {
            const response = await fetch(`${DAY_URL}/get-today`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error('Failed to fetch today');
            }
            return response.json();
        });
    },

    async getCalendarDays(from: string, to: string, signal?: AbortSignal): Promise<DayCalendarEntry[]> {
        const params = new URLSearchParams({ from, to });
        const response = await fetch(`${DAY_URL}/calendar-days?${params.toString()}`, {
            headers: getAuthHeaders(),
            signal,
        });
        if (!response.ok) {
            throw new Error('Failed to fetch calendar days');
        }
        return response.json();
    },

    async clearAppliedTemplate(date: string): Promise<void> {
        const response = await fetch(`${DAY_URL}/clear-applied-template/${encodeURIComponent(date)}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to clear applied day template');
        }
    },

    async setTodayInfo(rating: number, plan: string, summary: string): Promise<void> {
        const response = await fetch(`${DAY_URL}/set-today-info`, {
            method: 'POST',
            body: JSON.stringify({
                dayRating: rating,
                dayPlan: plan,
                daySummary: summary,
            }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) {
            throw new Error('Failed to update today info');
        }
        todayCache.invalidate(todayCacheKey());
    },

    clearCache(): void {
        todayCache.clear();
    },
};
