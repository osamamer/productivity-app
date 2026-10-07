self.addEventListener('push', event => {
    event.waitUntil((async () => {
        let notification = {};
        try {
            notification = event.data ? event.data.json() : {};
        } catch (error) {
            console.error('Could not read browser push notification:', error);
        }

        const notificationId = typeof notification.notificationId === 'string'
            ? notification.notificationId
            : crypto.randomUUID();
        const tag = `productivity-${notificationId}`;
        const existing = await self.registration.getNotifications({ tag });
        if (existing.length > 0) return;

        let body = notification.body || '';
        if (notification.type === 'CALENDAR_EVENT') {
            const eventTime = notification.allDay
                ? 'All day'
                : new Date(notification.eventStart).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                });
            body = `Event reminder · ${eventTime}`;
        }

        await self.registration.showNotification(notification.title || 'Reminder', {
            body,
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag,
            data: {
                notificationId,
                targetUrl: notification.targetUrl || '/',
            },
        });

        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription && notification.notificationId) {
            try {
                await fetch('/api/v1/notifications/web-push/acknowledge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        notificationId: notification.notificationId,
                        endpoint: subscription.endpoint,
                    }),
                });
            } catch (error) {
                console.error('Could not acknowledge the browser push notification:', error);
            }
        }
    })());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil((async () => {
        const target = new URL(event.notification.data?.targetUrl || '/', self.location.origin);
        if (target.origin !== self.location.origin) target.href = self.location.origin;
        if (event.notification.data?.notificationId) {
            target.searchParams.set('_notificationId', event.notification.data.notificationId);
        }

        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            if (new URL(client.url).origin !== self.location.origin) continue;
            await client.navigate(target.href);
            await client.focus();
            return;
        }
        await self.clients.openWindow(target.href);
    })());
});
