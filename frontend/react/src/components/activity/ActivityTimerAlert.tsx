import { useEffect, useRef } from 'react';
import { useActivityTimer } from '../../hooks/useActivityTimer';
import { showSystemNotification } from '../../services/systemNotifications';

/**
 * Says when a countdown reaches its end, from anywhere in the app. The timer keeps running
 * after that; stopping it is the user's call.
 *
 * Limitation: only while the app is open; the server does not push this yet.
 */
export function ActivityTimerAlert() {
    const { current } = useActivityTimer();
    const notifiedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!current?.targetEndAt || current.paused) return undefined;
        const key = `${current.id}:${current.targetEndAt}`;
        if (notifiedRef.current === key) return undefined;
        const delay = Date.parse(current.targetEndAt) - Date.now();
        if (delay < -60_000) return undefined;
        const timer = window.setTimeout(() => {
            notifiedRef.current = key;
            void showSystemNotification(`${current.title}: time's up`, {
                body: 'The time you set aside is over.',
                tag: `activity-timer-${current.id}`,
                data: { targetUrl: '/now' },
            });
        }, Math.max(0, delay));
        return () => window.clearTimeout(timer);
    }, [current]);

    return null;
}
