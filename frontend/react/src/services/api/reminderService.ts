import { ReminderNotification } from '../../types/CalendarEvent';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const REMINDER_URL = `${API_BASE_URL}/api/v1/reminders`;

export const reminderService = {
    async getPending(): Promise<ReminderNotification[]> {
        const response = await fetch(`${REMINDER_URL}/pending`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to load pending reminders');
        return response.json();
    },

    async acknowledge(reminderId: string): Promise<void> {
        const response = await fetch(`${REMINDER_URL}/${reminderId}/acknowledge`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to acknowledge reminder');
    },
};
