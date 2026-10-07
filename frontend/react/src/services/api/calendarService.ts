import { Calendar, CalendarColor, CalendarUpdate } from '../../types/Calendar';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const CALENDAR_URL = `${API_BASE_URL}/api/v1/calendars`;

async function parseError(response: Response, fallback: string): Promise<Error> {
    const message = await response.text();
    return new Error(message || fallback);
}

export const calendarService = {
    async getCalendars(): Promise<Calendar[]> {
        const response = await fetch(CALENDAR_URL, { headers: getAuthHeaders() });
        if (!response.ok) throw await parseError(response, 'Failed to load calendars');
        return response.json();
    },

    async createCalendar(name: string, color: CalendarColor): Promise<Calendar> {
        const response = await fetch(CALENDAR_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ name, color }),
        });
        if (!response.ok) throw await parseError(response, 'Failed to create calendar');
        return response.json();
    },

    async updateCalendar(calendarId: string, updates: CalendarUpdate): Promise<Calendar> {
        const response = await fetch(`${CALENDAR_URL}/${calendarId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(updates),
        });
        if (!response.ok) throw await parseError(response, 'Failed to update calendar');
        return response.json();
    },

    async deleteCalendar(calendarId: string): Promise<void> {
        const response = await fetch(`${CALENDAR_URL}/${calendarId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await parseError(response, 'Failed to delete calendar');
    },
};
