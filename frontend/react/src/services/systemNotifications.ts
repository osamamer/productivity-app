export type SystemNotificationOptions = NotificationOptions & {
    tag?: string;
};

function supportsSystemNotifications(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestSystemNotificationPermission(): Promise<void> {
    if (supportsSystemNotifications() && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

export function showSystemNotification(
    title: string,
    options?: SystemNotificationOptions,
): Notification | null {
    if (!supportsSystemNotifications() || Notification.permission !== 'granted') {
        return null;
    }

    try {
        return new Notification(title, options);
    } catch (error) {
        console.error('Failed to show system notification:', error);
        return null;
    }
}
