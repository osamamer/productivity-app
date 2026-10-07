export type SystemNotificationOptions = NotificationOptions & {
    tag?: string;
};

function supportsSystemNotifications(): boolean {
    return typeof window !== 'undefined'
        && 'Notification' in window
        && 'serviceWorker' in navigator;
}

export async function requestSystemNotificationPermission(): Promise<void> {
    if (supportsSystemNotifications() && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

export async function showSystemNotification(
    title: string,
    options?: SystemNotificationOptions,
): Promise<boolean> {
    if (!supportsSystemNotifications() || Notification.permission !== 'granted') {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const existing = options?.tag
            ? await registration.getNotifications({ tag: options.tag })
            : [];
        if (existing.length === 0) {
            await registration.showNotification(title, options);
        }
        return true;
    } catch (error) {
        console.error('Failed to show system notification:', error);
        return false;
    }
}
