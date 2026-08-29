import { Alert, Snackbar } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reminderService } from '../../services/api/reminderService';
import { ReminderNotification } from '../../types/CalendarEvent';
import { useUser } from '../../contexts/UserContext';
import { showSystemNotification } from '../../services/systemNotifications';
import { createAuthenticatedStompClient } from '../../services/authenticatedStompClient';

const WS_URL = (import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`);

export function ReminderNotifications() {
    const { loading: userLoading, isAuthenticated } = useUser();
    const handled = useRef(new Set<string>());
    const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

    const deliver = useCallback(async (reminder: ReminderNotification) => {
        if (handled.current.has(reminder.reminderId)) return;
        handled.current.add(reminder.reminderId);

        const eventTime = reminder.allDay
            ? 'All day'
            : new Date(reminder.eventStart).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        const notification = showSystemNotification(reminder.title, {
            body: `Event reminder · ${eventTime}`,
            tag: `event-reminder-${reminder.reminderId}`,
        });
        if (notification) {
            notification.onclick = () => {
                window.focus();
                window.history.pushState(null, '', '/calendar');
                window.dispatchEvent(new PopStateEvent('popstate'));
                notification.close();
            };
        } else {
            setFallbackMessage(`${reminder.title} · ${eventTime}`);
        }

        try {
            await reminderService.acknowledge(reminder.reminderId);
        } catch (error) {
            handled.current.delete(reminder.reminderId);
            console.error('Failed to acknowledge reminder:', error);
        }
    }, []);

    useEffect(() => {
        if (userLoading || !isAuthenticated) return;

        let active = true;
        const loadPending = () => reminderService.getPending()
            .then(reminders => active && reminders.forEach(reminder => void deliver(reminder)))
            .catch(error => console.error('Failed to retrieve pending reminders:', error));

        const client = createAuthenticatedStompClient(WS_URL);
        client.onConnect = () => {
            client.subscribe('/user/queue/reminders', message => {
                try {
                    void deliver(JSON.parse(message.body) as ReminderNotification);
                } catch (error) {
                    console.error('Failed to read reminder notification:', error);
                }
            });
            void loadPending();
        };
        client.onWebSocketError = error => console.error('Reminder WebSocket error:', error);
        client.onStompError = frame => console.error('Reminder STOMP error:', frame.headers.message);

        void loadPending();
        const recoveryInterval = window.setInterval(loadPending, 30_000);
        const recoverWhenVisible = () => {
            if (document.visibilityState === 'visible') void loadPending();
        };
        document.addEventListener('visibilitychange', recoverWhenVisible);
        client.activate();

        return () => {
            active = false;
            window.clearInterval(recoveryInterval);
            document.removeEventListener('visibilitychange', recoverWhenVisible);
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
