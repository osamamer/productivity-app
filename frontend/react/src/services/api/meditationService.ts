import { apiFetch } from '../utils/apiFetch';
import { MeditationSession, StartMeditationRequest } from '../../types/MeditationSession';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';
import { statService } from './statService';
import { invalidateResource } from '../cache/resourceInvalidation';
import { taskService } from './taskService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const MEDITATION_URL = `${API_BASE_URL}/api/v1/meditation`;
const ACTIVE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const activeSessionCache = new CachedResource<MeditationSession | null>({ ttlMs: ACTIVE_SESSION_TTL_MS, maxEntries: 4 });

function activeSessionKey(): string {
    return `${getAuthCacheScope()}:active-meditation`;
}

function cachedActiveSession(): MeditationSession | null | undefined {
    const cached = activeSessionCache.getCached(activeSessionKey());
    if (cached?.expiresAt && Date.parse(cached.expiresAt) <= Date.now()) {
        activeSessionCache.invalidate(activeSessionKey());
        return undefined;
    }
    return cached;
}

function jsonHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json; charset=UTF-8',
        ...getAuthHeaders(),
    };
}

export const meditationService = {
    getCachedActiveSession(): MeditationSession | null | undefined {
        return cachedActiveSession();
    },

    async getSession(sessionId: string): Promise<MeditationSession | null> {
        const response = await apiFetch(`${MEDITATION_URL}/${sessionId}`, { headers: getAuthHeaders() });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Failed to restore meditation session');
        return response.json();
    },
    async getActiveSession(forceRefresh = false): Promise<MeditationSession | null> {
        if (forceRefresh) activeSessionCache.invalidate(activeSessionKey());
        else {
            const cached = cachedActiveSession();
            if (cached !== undefined) return cached;
        }
        return activeSessionCache.get(activeSessionKey(), async () => {
            const response = await apiFetch(`${MEDITATION_URL}/active`, {
                headers: getAuthHeaders(),
            });
            if (response.status === 204) return null;
            if (!response.ok) throw new Error('Failed to restore meditation session');
            return response.json() as Promise<MeditationSession>;
        });
    },

    async startSession(request: StartMeditationRequest): Promise<MeditationSession> {
        const response = await apiFetch(`${MEDITATION_URL}/start`, {
            method: 'POST',
            body: JSON.stringify(request),
            headers: jsonHeaders(),
        });

        if (!response.ok) throw new Error('Failed to start meditation session');
        const session = await response.json() as MeditationSession;
        activeSessionCache.set(activeSessionKey(), session);
        return session;
    },

    async pauseSession(sessionId: string): Promise<MeditationSession> {
        const session = await updateSession(`${sessionId}/pause`, 'Failed to pause meditation session');
        activeSessionCache.set(activeSessionKey(), session);
        return session;
    },

    async unpauseSession(sessionId: string): Promise<MeditationSession> {
        const session = await updateSession(`${sessionId}/unpause`, 'Failed to resume meditation session');
        activeSessionCache.set(activeSessionKey(), session);
        return session;
    },

    async endSession(sessionId: string, moodAfter?: number, useIntendedDuration = false): Promise<MeditationSession> {
        const body = moodAfter === undefined && !useIntendedDuration
            ? undefined
            : JSON.stringify({ moodAfter, useIntendedDuration });
        const response = await apiFetch(`${MEDITATION_URL}/${sessionId}/end`, {
            method: 'POST',
            body,
            headers: body === undefined ? getAuthHeaders() : jsonHeaders(),
        });

        if (!response.ok) throw new Error('Failed to finish meditation session');
        const session = await response.json() as MeditationSession;
        activeSessionCache.set(activeSessionKey(), null);
        statService.clearDataCache();
        taskService.clearCache();
        invalidateResource('tasks', 'task');
        return session;
    },

    async discardSession(sessionId: string): Promise<void> {
        const response = await apiFetch(`${MEDITATION_URL}/${sessionId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error('Failed to dismiss meditation session');
        activeSessionCache.set(activeSessionKey(), null);
        statService.clearDataCache();
    },

    endSessionOnUnload(sessionId: string): void {
        activeSessionCache.invalidate(activeSessionKey());
        void apiFetch(`${MEDITATION_URL}/${sessionId}/end`, {
            method: 'POST',
            headers: getAuthHeaders(),
            keepalive: true,
        }).catch(error => {
            console.error('Failed to finish meditation session while leaving the app', error);
        });
    },

    clearCache(): void {
        activeSessionCache.clear();
    },
};

async function updateSession(path: string, errorMessage: string): Promise<MeditationSession> {
    const response = await apiFetch(`${MEDITATION_URL}/${path}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error(errorMessage);
    return response.json();
}
