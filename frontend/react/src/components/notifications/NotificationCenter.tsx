import { Alert, Snackbar } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { createAuthenticatedStompClient } from '../../services/authenticatedStompClient';
import { notificationService } from '../../services/api/notificationService';
import { showSystemNotification } from '../../services/systemNotifications';
import { ApplicationNotification } from '../../types/ApplicationNotification';

const WS_URL = import.meta.env.VITE_WS_URL
    || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
const DELIVERY_LEDGER_KEY = 'presented-notification-ids';
const MAX_LEDGER_SIZE = 200;

function notificationBody(notification: ApplicationNotification): string {
    if (notification.type !== 'CALENDAR_EVENT') {
        return notification.body || '';
    }
    const eventTime = notification.allDay
        ? 'All day'
        : new Date(notification.eventStart!).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    return `Event reminder · ${eventTime}`;
}

function notificationSummary(notification: ApplicationNotification): string {
    const body = notificationBody(notification);
    return body ? `${notification.title} · ${body}` : notification.title;
}

function readDeliveryLedger(): string[] {
    try {
        const value = JSON.parse(localStorage.getItem(DELIVERY_LEDGER_KEY) || '[]');
        return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

function rememberPresentation(notificationId: string): void {
    const ledger = readDeliveryLedger().filter(id => id !== notificationId);
    ledger.push(notificationId);
    localStorage.setItem(DELIVERY_LEDGER_KEY, JSON.stringify(ledger.slice(-MAX_LEDGER_SIZE)));
}

async function withNotificationLock(notificationId: string, work: () => Promise<void>): Promise<void> {
    if (!navigator.locks) {
        await work();
        return;
    }
    await navigator.locks.request(`notification-delivery-${notificationId}`, work);
}

export function NotificationCenter() {
    const { loading: userLoading, isAuthenticated } = useUser();
    const navigate = useNavigate();
    const inFlight = useRef(new Set<string>());
    const queuedFallbacks = useRef(new Set<string>());
    const [fallbackQueue, setFallbackQueue] = useState<ApplicationNotification[]>([]);

    const deliver = useCallback(async (notification: ApplicationNotification) => {
        if (inFlight.current.has(notification.notificationId)) return;
        inFlight.current.add(notification.notificationId);

        try {
            await withNotificationLock(notification.notificationId, async () => {
                if (!readDeliveryLedger().includes(notification.notificationId)) {
                    const body = notificationBody(notification);
                    const systemNotification = showSystemNotification(notification.title, {
                        body,
                        tag: `productivity-${notification.notificationId}`,
                    });
                    if (systemNotification) {
                        systemNotification.onclick = () => {
                            window.focus();
                            if (notification.targetUrl) navigate(notification.targetUrl);
                            systemNotification.close();
                        };
                        rememberPresentation(notification.notificationId);
                        try {
                            await notificationService.acknowledge(notification.notificationId);
                        } catch (error) {
                            console.error('Failed to acknowledge presented notification:', error);
                        }
                    } else if (!queuedFallbacks.current.has(notification.notificationId)) {
                        queuedFallbacks.current.add(notification.notificationId);
                        setFallbackQueue(current => [...current, notification]);
                    }
                } else {
                    try {
                        await notificationService.acknowledge(notification.notificationId);
                    } catch (error) {
                        console.error('Failed to acknowledge presented notification:', error);
                    }
                }
            });
        } finally {
            inFlight.current.delete(notification.notificationId);
        }
    }, [navigate]);

    useEffect(() => {
        const current = fallbackQueue[0];
        if (!current) return;

        rememberPresentation(current.notificationId);
        void notificationService.acknowledge(current.notificationId).catch(error => {
            console.error('Failed to acknowledge presented fallback notification:', error);
        });
    }, [fallbackQueue]);

    useEffect(() => {
        if (userLoading || !isAuthenticated) return;

        let active = true;
        const synchronize = async () => {
            try {
                const notifications = await notificationService.getDue();
                if (active) notifications.forEach(notification => void deliver(notification));
            } catch (error) {
                console.error('Failed to synchronize notifications:', error);
            }
        };

        const client = createAuthenticatedStompClient(WS_URL);
        client.onConnect = () => {
            client.subscribe('/user/queue/notifications', message => {
                try {
                    void deliver(JSON.parse(message.body) as ApplicationNotification);
                } catch (error) {
                    console.error('Failed to read notification push:', error);
                }
            });
            void synchronize();
        };
        client.onWebSocketError = error => console.error('Notification WebSocket error:', error);
        client.onStompError = frame => console.error('Notification STOMP error:', frame.headers.message);

        const recoverWhenVisible = () => {
            if (document.visibilityState === 'visible') void synchronize();
        };
        const recoverWhenFocused = () => void synchronize();
        const recoveryInterval = window.setInterval(synchronize, 30_000);
        document.addEventListener('visibilitychange', recoverWhenVisible);
        window.addEventListener('focus', recoverWhenFocused);
        window.addEventListener('online', recoverWhenFocused);
        client.activate();
        void synchronize();

        return () => {
            active = false;
            window.clearInterval(recoveryInterval);
            document.removeEventListener('visibilitychange', recoverWhenVisible);
            window.removeEventListener('focus', recoverWhenFocused);
            window.removeEventListener('online', recoverWhenFocused);
            void client.deactivate();
        };
    }, [deliver, isAuthenticated, userLoading]);

    const currentFallback = fallbackQueue[0] || null;
    const closeFallback = () => setFallbackQueue(current => {
        if (current[0]) queuedFallbacks.current.delete(current[0].notificationId);
        return current.slice(1);
    });

    return (
        <Snackbar key={currentFallback?.notificationId} open={Boolean(currentFallback)} autoHideDuration={10000}
                  onClose={closeFallback} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
            <Alert severity="info" variant="filled" onClose={closeFallback}>
                {currentFallback && notificationSummary(currentFallback)}
            </Alert>
        </Snackbar>
    );
}
