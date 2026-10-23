import { apiFetch } from '../utils/apiFetch';
import { Calendar, CalendarColor, CalendarUpdate } from '../../types/Calendar';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const CALENDAR_URL = `${API_BASE_URL}/api/v1/calendars`;
const CALENDAR_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const calendarUpdateVersions = new Map<string, number>();

function calendarSnapshotKey(): string {
    return `claritard:${getAuthCacheScope()}:calendars`;
}

function readCalendarSnapshot(): Calendar[] | undefined {
    if (typeof window === 'undefined') return undefined;

    try {
        const raw = window.sessionStorage.getItem(calendarSnapshotKey());
        if (!raw) return undefined;
        const snapshot = JSON.parse(raw) as { savedAt?: number; calendars?: Calendar[] };
        if (!Array.isArray(snapshot.calendars)
            || typeof snapshot.savedAt !== 'number'
            || Date.now() - snapshot.savedAt > CALENDAR_SNAPSHOT_MAX_AGE_MS) {
            window.sessionStorage.removeItem(calendarSnapshotKey());
            return undefined;
        }
        return snapshot.calendars;
    } catch (error) {
        console.warn('Could not read the cached calendars:', error);
        return undefined;
    }
}

function persistCalendarSnapshot(calendars: Calendar[]): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(calendarSnapshotKey(), JSON.stringify({
            savedAt: Date.now(),
            calendars,
        }));
    } catch (error) {
        console.warn('Could not persist the cached calendars:', error);
    }
}

function updateCalendarSnapshot(update: (calendars: Calendar[]) => Calendar[]): void {
    const calendars = readCalendarSnapshot();
    if (calendars) persistCalendarSnapshot(update(calendars));
}

async function parseError(response: Response, fallback: string): Promise<Error> {
    const message = await response.text();
    return new Error(message || fallback);
}

export const calendarService = {
    getCachedCalendars(): Calendar[] | undefined {
        return readCalendarSnapshot();
    },

    async getCalendars(): Promise<Calendar[]> {
        const response = await apiFetch(CALENDAR_URL, { headers: getAuthHeaders() });
        if (!response.ok) throw await parseError(response, 'Failed to load calendars');
        const calendars = await response.json() as Calendar[];
        persistCalendarSnapshot(calendars);
        return calendars;
    },

    async createCalendar(name: string, color: CalendarColor): Promise<Calendar> {
        const response = await apiFetch(CALENDAR_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ name, color }),
        });
        if (!response.ok) throw await parseError(response, 'Failed to create calendar');
        const created = await response.json() as Calendar;
        const calendars = readCalendarSnapshot();
        if (calendars) {
            persistCalendarSnapshot([...calendars, created]
                .sort((first, second) => first.displayOrder - second.displayOrder));
        }
        return created;
    },

    async updateCalendar(calendarId: string, updates: CalendarUpdate): Promise<Calendar> {
        const version = (calendarUpdateVersions.get(calendarId) ?? 0) + 1;
        calendarUpdateVersions.set(calendarId, version);
        const response = await apiFetch(`${CALENDAR_URL}/${calendarId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(updates),
        });
        if (!response.ok) throw await parseError(response, 'Failed to update calendar');
        const updated = await response.json() as Calendar;
        if (calendarUpdateVersions.get(calendarId) === version) {
            updateCalendarSnapshot(calendars => calendars.map(calendar => (
                calendar.id === updated.id ? updated : calendar
            )));
        }
        return updated;
    },

    async deleteCalendar(calendarId: string): Promise<void> {
        const response = await apiFetch(`${CALENDAR_URL}/${calendarId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await parseError(response, 'Failed to delete calendar');
        updateCalendarSnapshot(calendars => calendars.filter(calendar => calendar.id !== calendarId));
    },

    clearCache(): void {
        if (typeof window === 'undefined') return;
        try {
            window.sessionStorage.removeItem(calendarSnapshotKey());
        } catch (error) {
            console.warn('Could not clear the cached calendars:', error);
        }
    },
};
