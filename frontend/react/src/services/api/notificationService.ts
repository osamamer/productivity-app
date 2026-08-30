import { ApplicationNotification } from '../../types/ApplicationNotification';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const NOTIFICATION_URL = `${API_BASE_URL}/api/v1/notifications`;

export const notificationService = {
    async getDue(): Promise<ApplicationNotification[]> {
        const response = await fetch(`${NOTIFICATION_URL}/due`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to load due notifications');
        return response.json();
    },

    async acknowledge(notificationId: string): Promise<void> {
        const response = await fetch(`${NOTIFICATION_URL}/${notificationId}/acknowledge`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to acknowledge notification');
    },
};
