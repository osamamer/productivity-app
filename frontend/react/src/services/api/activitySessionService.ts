import { apiFetch } from '../utils/apiFetch';
import { getAuthHeaders } from '../utils/authHeaders';
import { ActivitySession, StartActivitySessionInput } from '../../types/ActivitySession';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const SESSIONS_URL = `${API_BASE_URL}/api/v1/activity-sessions`;

async function readJson<T>(response: Response, failure: string): Promise<T> {
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? failure);
    }
    return response.json() as Promise<T>;
}

async function post(path: string, failure: string, body?: unknown): Promise<ActivitySession> {
    return readJson(await apiFetch(`${SESSIONS_URL}${path}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    }), failure);
}

export const activitySessionService = {
    /** The running or paused timer, or null. */
    async getCurrent(): Promise<ActivitySession | null> {
        const response = await apiFetch(`${SESSIONS_URL}/current`, { headers: getAuthHeaders() });
        if (response.status === 204) return null;
        return readJson(response, 'Could not load the timer.');
    },

    start(input: StartActivitySessionInput): Promise<ActivitySession> {
        return post('', 'Could not start the timer.', input);
    },

    pause(sessionId: string): Promise<ActivitySession> {
        return post(`/${encodeURIComponent(sessionId)}/pause`, 'Could not pause the timer.');
    },

    resume(sessionId: string): Promise<ActivitySession> {
        return post(`/${encodeURIComponent(sessionId)}/resume`, 'Could not resume the timer.');
    },

    end(sessionId: string): Promise<ActivitySession> {
        return post(`/${encodeURIComponent(sessionId)}/end`, 'Could not stop the timer.');
    },
};
