import { apiFetch } from '../utils/apiFetch';
import { getAuthHeaders } from '../utils/authHeaders';
import { Activity, ActivityInput } from '../../types/Activity';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const ACTIVITIES_URL = `${API_BASE_URL}/api/v1/activities`;

async function readJson<T>(response: Response, failure: string): Promise<T> {
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? failure);
    }
    return response.json() as Promise<T>;
}

export const activityService = {
    async getActivities(): Promise<Activity[]> {
        return readJson(await apiFetch(ACTIVITIES_URL, { headers: getAuthHeaders() }), 'Could not load activities.');
    },

    async createActivity(input: ActivityInput): Promise<Activity> {
        return readJson(await apiFetch(ACTIVITIES_URL, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        }), 'Could not add the activity.');
    },

    async updateActivity(activityId: string, input: ActivityInput): Promise<Activity> {
        return readJson(await apiFetch(`${ACTIVITIES_URL}/${encodeURIComponent(activityId)}`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        }), 'Could not save the activity.');
    },

    async deleteActivity(activityId: string): Promise<void> {
        const response = await apiFetch(`${ACTIVITIES_URL}/${encodeURIComponent(activityId)}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Could not delete the activity.');
    },
};
