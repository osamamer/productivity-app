import { desktopBridge } from './desktop';

export type SystemNotificationOptions = NotificationOptions & {
    tag?: string;
};

function supportsSystemNotifications(): boolean {
    return typeof window !== 'undefined'
        && 'Notification' in window
        && 'serviceWorker' in navigator;
}

export async function requestSystemNotificationPermission(): Promise<void> {
    if (desktopBridge) return;
    if (supportsSystemNotifications() && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function targetUrlOf(options?: SystemNotificationOptions): string | undefined {
    const data = options?.data as { targetUrl?: unknown } | undefined;
    return typeof data?.targetUrl === 'string' ? data.targetUrl : undefined;
}

async function showDesktopNotification(title: string, options?: SystemNotificationOptions): Promise<boolean> {
    try {
        return await desktopBridge!.showNotification({
            title,
            body: options?.body,
            tag: options?.tag,
            targetUrl: targetUrlOf(options),
        });
    } catch (error) {
        console.error('Failed to show desktop notification:', error);
        return false;
    }
}

export async function showSystemNotification(
    title: string,
    options?: SystemNotificationOptions,
): Promise<boolean> {
    if (desktopBridge) return showDesktopNotification(title, options);
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
