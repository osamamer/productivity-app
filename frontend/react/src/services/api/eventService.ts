import { CalendarEvent, CalendarEventInput } from '../../types/CalendarEvent';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const EVENT_URL = `${API_BASE_URL}/api/v1/events`;
const EVENTS_TTL_MS = 60 * 1000;
const eventsCache = new CachedResource<CalendarEvent[]>({ ttlMs: EVENTS_TTL_MS, maxEntries: 4 });

function eventsCacheKey(): string {
    return `${getAuthCacheScope()}:events`;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
    const message = await response.text();
    return new Error(message || fallback);
}

export const eventService = {
    async getEvents(): Promise<CalendarEvent[]> {
        return eventsCache.get(eventsCacheKey(), async () => {
            const response = await fetch(EVENT_URL, { headers: getAuthHeaders() });
            if (!response.ok) throw await parseError(response, 'Failed to load events');
            return response.json();
        });
    },

    async createEvent(event: CalendarEventInput): Promise<CalendarEvent> {
        const response = await fetch(EVENT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(event),
        });
        if (!response.ok) throw await parseError(response, 'Failed to create event');
        eventsCache.invalidate(eventsCacheKey());
        return response.json();
    },

    async updateEvent(eventId: string, event: CalendarEventInput): Promise<CalendarEvent> {
        const response = await fetch(`${EVENT_URL}/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(event),
        });
        if (!response.ok) throw await parseError(response, 'Failed to update event');
        eventsCache.invalidate(eventsCacheKey());
        return response.json();
    },

    async deleteEvent(eventId: string): Promise<void> {
        const response = await fetch(`${EVENT_URL}/${eventId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await parseError(response, 'Failed to delete event');
        eventsCache.invalidate(eventsCacheKey());
    },

    clearCache(): void {
        eventsCache.clear();
    },
};
