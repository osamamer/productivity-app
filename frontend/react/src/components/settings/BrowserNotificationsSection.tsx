import { ChangeEvent, memo, useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Switch,
    Typography,
} from '@mui/material';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { notificationService, type WebPushSubscriptionPayload } from '../../services/api/notificationService';

import { sectionCardSx, sectionHeadingSx } from './settingsStyles';

function decodeApplicationServerKey(value: string): Uint8Array {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

function serializePushSubscription(subscription: PushSubscription): WebPushSubscriptionPayload {
    const value = subscription.toJSON();
    if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) {
        throw new Error('The browser returned an incomplete push subscription');
    }
    return {
        endpoint: value.endpoint,
        keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
    };
}

export const BrowserNotificationsSection = memo(function BrowserNotificationsSection() {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            setUnavailable(true);
            setLoading(false);
            return;
        }

        void notificationService.getWebPushPublicKey()
            .then(async key => {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    if (Notification.permission === 'granted') {
                        await notificationService.registerWebPushSubscription(serializePushSubscription(subscription));
                    } else {
                        await notificationService.removeWebPushSubscription(subscription.endpoint);
                        await subscription.unsubscribe();
                    }
                }
                if (!cancelled) {
                    setPublicKey(key);
                    setEnabled(Boolean(subscription && Notification.permission === 'granted'));
                }
            })
            .catch(loadError => {
                console.error('Could not load browser notification support:', loadError);
                if (!cancelled) setUnavailable(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const handleChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const shouldEnable = event.target.checked;
        setSaving(true);
        setError(null);
        try {
            if (shouldEnable) {
                const permission = Notification.permission === 'granted'
                    ? 'granted'
                    : await Notification.requestPermission();
                if (permission !== 'granted') {
                    setError(permission === 'denied'
                        ? 'Allow notifications for this site in your browser settings.'
                        : 'Browser notification permission was not granted.');
                    return;
                }
                if (!publicKey) {
                    setError('Browser notifications are unavailable right now.');
                    return;
                }

                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription()
                    || await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: decodeApplicationServerKey(publicKey),
                    });
                await notificationService.registerWebPushSubscription(serializePushSubscription(subscription));
                setEnabled(true);
            } else {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await notificationService.removeWebPushSubscription(subscription.endpoint);
                    await subscription.unsubscribe();
                }
                setEnabled(false);
            }
        } catch (caughtError) {
            console.error('Failed to update browser notifications:', caughtError);
            setError('Could not update browser notifications right now. Try again.');
        } finally {
            setSaving(false);
        }
    }, [publicKey]);

    return (
        <Box sx={sectionCardSx}>
            <Box sx={sectionHeadingSx}>
                <NotificationsActiveOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Browser notifications
                </Typography>
            </Box>
            {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        Notify me when the app is closed
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Receive reminders on this browser when Claritard is closed. Pomodoro transition alerts play and appear locally while the app is open.
                    </Typography>
                </Box>
                <Switch
                    checked={enabled}
                    onChange={handleChange}
                    disabled={loading || saving || unavailable
                        || (typeof Notification !== 'undefined' && Notification.permission === 'denied')}
                    inputProps={{ 'aria-label': 'Enable browser notifications when Claritard is closed' }}
                />
            </Box>
            {unavailable && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Background notifications are unavailable in this browser or app configuration.
                </Typography>
            )}
            {!unavailable && typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Notifications are blocked for this site. Change the permission in your browser settings to enable them.
                </Typography>
            )}
        </Box>
    );
});
