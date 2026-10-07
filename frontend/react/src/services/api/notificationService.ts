import { ApplicationNotification } from '../../types/ApplicationNotification';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const NOTIFICATION_URL = `${API_BASE_URL}/api/v1/notifications`;

export interface WebPushSubscriptionPayload {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

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

    async getWebPushPublicKey(): Promise<string> {
        const response = await fetch(`${NOTIFICATION_URL}/web-push/public-key`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Browser notifications are unavailable');
        const result = await response.json() as { publicKey: string };
        return result.publicKey;
    },

    async registerWebPushSubscription(subscription: WebPushSubscriptionPayload): Promise<void> {
        const response = await fetch(`${NOTIFICATION_URL}/web-push/subscription`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
        });
        if (!response.ok) throw new Error('Could not enable browser notifications');
    },

    async removeWebPushSubscription(endpoint: string): Promise<void> {
        const response = await fetch(`${NOTIFICATION_URL}/web-push/subscription`, {
            method: 'DELETE',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
        });
        if (!response.ok) throw new Error('Could not disable browser notifications');
    },
};
