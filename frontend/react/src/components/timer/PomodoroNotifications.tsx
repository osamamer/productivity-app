import { Alert, Snackbar } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { showSystemNotification } from '../../services/systemNotifications';
import { PomodoroTransitionNotification } from '../../types/PomodoroTransitionNotification';
import { createAuthenticatedStompClient } from '../../services/authenticatedStompClient';

const WS_URL = (import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`);

function notificationCopy(notification: PomodoroTransitionNotification): { title: string; body: string } {
    const taskName = notification.taskName || 'Pomodoro task';
    switch (notification.transition) {
        case 'FOCUS_ENDED':
            return { title: 'Focus session complete', body: `${taskName} · Break ready` };
        case 'BREAK_ENDED':
            return { title: 'Break complete', body: `${taskName} · Focus session ready` };
        case 'POMODORO_ENDED':
            return { title: 'Pomodoro complete', body: `${taskName} · All focus sessions finished` };
    }
}

export function PomodoroNotifications() {
    const { loading: userLoading, isAuthenticated } = useUser();
    const handled = useRef(new Set<string>());
    const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

    const deliver = useCallback((notification: PomodoroTransitionNotification) => {
        if (handled.current.has(notification.notificationId)) return;
        handled.current.add(notification.notificationId);

        const copy = notificationCopy(notification);
        const systemNotification = showSystemNotification(copy.title, {
            body: copy.body,
            tag: `pomodoro-${notification.notificationId}`,
        });
        if (systemNotification) {
            systemNotification.onclick = () => {
                window.focus();
                systemNotification.close();
            };
        } else {
            setFallbackMessage(`${copy.title} · ${copy.body}`);
        }
    }, []);

    useEffect(() => {
        if (userLoading || !isAuthenticated) return;

        const client = createAuthenticatedStompClient(WS_URL);
        client.onConnect = () => {
            client.subscribe('/user/queue/pomodoro', message => {
                try {
                    deliver(JSON.parse(message.body) as PomodoroTransitionNotification);
                } catch (error) {
                    console.error('Failed to read Pomodoro notification:', error);
                }
            });
        };
        client.onWebSocketError = error => console.error('Pomodoro WebSocket error:', error);
        client.onStompError = frame => console.error('Pomodoro STOMP error:', frame.headers.message);
        client.activate();

        return () => {
            void client.deactivate();
        };
    }, [deliver, isAuthenticated, userLoading]);

    return (
        <Snackbar open={Boolean(fallbackMessage)} autoHideDuration={10000}
                  onClose={() => setFallbackMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
            <Alert severity="info" variant="filled" onClose={() => setFallbackMessage(null)}>
                {fallbackMessage}
            </Alert>
        </Snackbar>
    );
}
