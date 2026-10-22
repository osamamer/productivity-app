import { apiFetch } from '../utils/apiFetch';
import { getAuthHeaders } from '../utils/authHeaders';
import { CalendarColor } from '../../types/Calendar';

const base = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/v1/calendar-sources`;

export type CalendarSource = {
    id: string;
    calendarId: string;
    type: 'ICS_FILE' | 'ICS_URL';
    lastSyncedAt: string | null;
    lastError: string | null;
};

async function result(response: Response): Promise<CalendarSource> {
    if (!response.ok) throw new Error('Calendar import failed');
    return response.json();
}

export const calendarSourceService = {
    async list(): Promise<CalendarSource[]> {
        const response = await apiFetch(base, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Could not load calendar sources');
        return response.json();
    },
    subscribe(name: string, color: CalendarColor, url: string): Promise<CalendarSource> {
        return apiFetch(`${base}/url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ name, color, url }),
        }).then(result);
    },
    upload(name: string, color: CalendarColor, file: File): Promise<CalendarSource> {
        const body = new FormData();
        body.append('name', name);
        body.append('color', color);
        body.append('file', file);
        return apiFetch(`${base}/file`, { method: 'POST', headers: getAuthHeaders(), body }).then(result);
    },
    sync(sourceId: string): Promise<CalendarSource> {
        return apiFetch(`${base}/${sourceId}/sync`, { method: 'POST', headers: getAuthHeaders() }).then(result);
    },
};
