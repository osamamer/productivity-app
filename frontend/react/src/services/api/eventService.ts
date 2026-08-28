import { CalendarEvent, CalendarEventInput } from '../../types/CalendarEvent';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const EVENT_URL = `${API_BASE_URL}/api/v1/events`;

async function parseError(response: Response, fallback: string): Promise<Error> {
    const message = await response.text();
    return new Error(message || fallback);
}

export const eventService = {
    async getEvents(): Promise<CalendarEvent[]> {
        const response = await fetch(EVENT_URL, { headers: getAuthHeaders() });
        if (!response.ok) throw await parseError(response, 'Failed to load events');
        return response.json();
    },

    async createEvent(event: CalendarEventInput): Promise<CalendarEvent> {
        const response = await fetch(EVENT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(event),
        });
        if (!response.ok) throw await parseError(response, 'Failed to create event');
        return response.json();
    },

    async updateEvent(eventId: string, event: CalendarEventInput): Promise<CalendarEvent> {
        const response = await fetch(`${EVENT_URL}/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(event),
        });
        if (!response.ok) throw await parseError(response, 'Failed to update event');
        return response.json();
    },

    async deleteEvent(eventId: string): Promise<void> {
        const response = await fetch(`${EVENT_URL}/${eventId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await parseError(response, 'Failed to delete event');
    },
};
