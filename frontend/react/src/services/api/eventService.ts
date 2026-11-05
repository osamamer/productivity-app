import { apiFetch } from '../utils/apiFetch';
import {
    CalendarEvent,
    CalendarEventFutureDeletionResponse,
    CalendarEventInput,
    CalendarEventOccurrenceMoveInput,
    CalendarEventReminderScope,
} from '../../types/CalendarEvent';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const EVENT_URL = `${API_BASE_URL}/api/v1/events`;
const EVENTS_TTL_MS = 24 * 60 * 60 * 1000;
const EVENT_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const eventsCache = new CachedResource<CalendarEvent[]>({ ttlMs: EVENTS_TTL_MS, maxEntries: 4 });

function eventsCacheKey(): string {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `${getAuthCacheScope()}:events:${month}`;
}

function eventsStorageKey(): string {
    return `claritard:${getAuthCacheScope()}:events`;
}

function readPersistedEvents(): CalendarEvent[] | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        const raw = window.sessionStorage.getItem(eventsStorageKey());
        if (!raw) return undefined;
        const snapshot = JSON.parse(raw) as { monthKey?: string; savedAt?: number; events?: CalendarEvent[] };
        if (snapshot.monthKey !== eventsCacheKey() || !Array.isArray(snapshot.events) || typeof snapshot.savedAt !== 'number'
            || !Number.isFinite(snapshot.savedAt) || Date.now() - snapshot.savedAt > EVENT_SNAPSHOT_MAX_AGE_MS) {
            window.sessionStorage.removeItem(eventsStorageKey());
            return undefined;
        }
        return snapshot.events;
    } catch (error) {
        console.warn('Could not read the cached calendar events:', error);
        return undefined;
    }
}

function persistEvents(events: CalendarEvent[], cacheKey = eventsCacheKey()): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(eventsStorageKey(), JSON.stringify({ monthKey: cacheKey, savedAt: Date.now(), events }));
    } catch (error) {
        console.warn('Could not persist the cached calendar events:', error);
    }
}

function invalidateEvents(): void {
    eventsCache.invalidate(eventsCacheKey());
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(eventsStorageKey());
    } catch (error) {
        console.warn('Could not invalidate the cached calendar events:', error);
    }
}

function updateCachedEvents(update: (events: CalendarEvent[]) => CalendarEvent[]): void {
    const events = eventsCache.getStale(eventsCacheKey()) ?? readPersistedEvents();
    if (!events) {
        invalidateEvents();
        return;
    }
    const updated = update(events);
    eventsCache.set(eventsCacheKey(), updated);
    persistEvents(updated);
}

function replaceCachedEvents(updatedEvents: CalendarEvent[]): void {
    const replacements = new Map(updatedEvents.map(event => [event.id, event]));
    updateCachedEvents(events => events.map(event => replacements.get(event.id) ?? event));
}

async function parseError(response: Response, fallback: string): Promise<Error> {
    const message = await response.text();
    return new Error(message || fallback);
}

export const eventService = {
    async getEvents(forceRefresh = false): Promise<CalendarEvent[]> {
        if (forceRefresh) invalidateEvents();
        const key = eventsCacheKey();
        const events = await eventsCache.get(key, async () => {
            const response = await apiFetch(EVENT_URL, { headers: getAuthHeaders() });
            if (!response.ok) throw await parseError(response, 'Failed to load events');
            return response.json() as Promise<CalendarEvent[]>;
        });
        if (eventsCache.getCached(key) === events && key === eventsCacheKey()) persistEvents(events, key);
        return events;
    },

    async exportEvents(): Promise<void> {
        const response = await apiFetch(`${EVENT_URL}/export`, { headers: getAuthHeaders() });
        if (!response.ok) throw await parseError(response, 'Failed to export events');

        const objectUrl = URL.createObjectURL(await response.blob());
        const download = document.createElement('a');
        download.href = objectUrl;
        download.download = 'claritard-calendar.ics';
        download.style.display = 'none';
        document.body.append(download);
        download.click();
        download.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    },

    getLastKnownEvents(): CalendarEvent[] | undefined {
        return eventsCache.getStale(eventsCacheKey()) ?? readPersistedEvents();
    },

    cacheEvents(events: CalendarEvent[]): void {
        eventsCache.set(eventsCacheKey(), events);
        persistEvents(events);
    },

    async createEvent(event: CalendarEventInput): Promise<CalendarEvent> {
        const response = await apiFetch(EVENT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(event),
        });
        if (!response.ok) throw await parseError(response, 'Failed to create event');
        const created = await response.json() as CalendarEvent;
        updateCachedEvents(events => [...events, created]);
        return created;
    },

    async updateEvent(eventId: string, event: CalendarEventInput): Promise<CalendarEvent> {
        const response = await apiFetch(`${EVENT_URL}/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(event),
        });
        if (!response.ok) throw await parseError(response, 'Failed to update event');
        const updated = await response.json() as CalendarEvent;
        replaceCachedEvents([updated]);
        return updated;
    },

    async updateImportedEventReminder(
        eventId: string,
        minutesBefore: number | null,
        scope: CalendarEventReminderScope,
    ): Promise<CalendarEvent[]> {
        const response = await apiFetch(`${EVENT_URL}/${eventId}/reminder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ minutesBefore, scope }),
        });
        if (!response.ok) throw await parseError(response, 'Failed to update event reminder');
        const updated = await response.json() as CalendarEvent[];
        replaceCachedEvents(updated);
        return updated;
    },

    async moveEventOccurrence(
        eventId: string,
        occurrenceKey: string,
        move: CalendarEventOccurrenceMoveInput,
    ): Promise<CalendarEvent> {
        const response = await apiFetch(`${EVENT_URL}/${eventId}/occurrences/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ occurrenceKey, ...move }),
        });
        if (!response.ok) throw await parseError(response, 'Failed to move event occurrence');
        const updated = await response.json() as CalendarEvent;
        replaceCachedEvents([updated]);
        return updated;
    },

    async deleteEvent(eventId: string): Promise<void> {
        const response = await apiFetch(`${EVENT_URL}/${eventId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await parseError(response, 'Failed to delete event');
        updateCachedEvents(events => events.filter(event => event.id !== eventId));
    },

    async cancelEventOccurrence(eventId: string, occurrenceKey: string): Promise<CalendarEvent> {
        const response = await apiFetch(`${EVENT_URL}/${eventId}/occurrences/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ occurrenceKey }),
        });
        if (!response.ok) throw await parseError(response, 'Failed to cancel event occurrence');
        const updated = await response.json() as CalendarEvent;
        replaceCachedEvents([updated]);
        return updated;
    },

    async updateEventOccurrenceStatus(
        eventId: string,
        occurrenceKey: string,
        status: CalendarEvent['status'],
    ): Promise<CalendarEvent> {
        const response = await apiFetch(`${EVENT_URL}/${eventId}/occurrences/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ occurrenceKey, status }),
        });
        if (!response.ok) throw await parseError(response, 'Failed to update event occurrence status');
        const updated = await response.json() as CalendarEvent;
        replaceCachedEvents([updated]);
        return updated;
    },

    async deleteEventOccurrence(eventId: string, occurrenceKey: string): Promise<CalendarEvent> {
        const response = await apiFetch(`${EVENT_URL}/${eventId}/occurrences`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ occurrenceKey }),
        });
        if (!response.ok) throw await parseError(response, 'Failed to delete event occurrence');
        const updated = await response.json() as CalendarEvent;
        replaceCachedEvents([updated]);
        return updated;
    },

    async deleteFutureEventOccurrences(
        eventId: string,
        occurrenceKey: string,
    ): Promise<CalendarEventFutureDeletionResponse> {
        const response = await apiFetch(`${EVENT_URL}/${eventId}/occurrences/future`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ occurrenceKey }),
        });
        if (!response.ok) throw await parseError(response, 'Failed to delete future event occurrences');
        const result = await response.json() as CalendarEventFutureDeletionResponse;
        if (result.eventDeleted) {
            updateCachedEvents(events => events.filter(event => event.id !== eventId));
        } else if (result.event) {
            replaceCachedEvents([result.event]);
        }
        return result;
    },

    async restoreEventOccurrence(eventId: string, occurrenceKey: string): Promise<CalendarEvent> {
        const response = await apiFetch(
            `${EVENT_URL}/${eventId}/occurrences/cancel?occurrenceKey=${encodeURIComponent(occurrenceKey)}`,
            { method: 'DELETE', headers: getAuthHeaders() },
        );
        if (!response.ok) throw await parseError(response, 'Failed to restore event occurrence');
        const updated = await response.json() as CalendarEvent;
        replaceCachedEvents([updated]);
        return updated;
    },

    clearCache(): void {
        eventsCache.clear();
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.removeItem(eventsStorageKey());
            } catch (error) {
                console.warn('Could not clear the cached calendar events:', error);
            }
        }
    },
};
