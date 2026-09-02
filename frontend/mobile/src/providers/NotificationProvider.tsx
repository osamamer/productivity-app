import * as Notifications from 'expo-notifications';
import { PropsWithChildren, useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useAppPopup } from '@/providers/PopupProvider';
import { api } from '@/services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const { showInfo } = useAppPopup();
  const syncingRef = useRef(false);
  const shownRef = useRef(new Set<string>());

  const syncDue = useCallback(async () => {
    if (!isAuthenticated || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const due = await api.notifications.due();
      for (const notification of due) {
        if (shownRef.current.has(notification.notificationId)) continue;
        shownRef.current.add(notification.notificationId);
        try {
          if (Platform.OS === 'web') {
            await showInfo(notification.title, notification.body ?? undefined);
          } else {
            const permissions = await Notifications.getPermissionsAsync();
            const allowed = permissions.granted
              ? permissions
              : await Notifications.requestPermissionsAsync();
            if (allowed.granted) {
              await Notifications.scheduleNotificationAsync({
                content: { title: notification.title, body: notification.body ?? undefined },
                trigger: null,
              });
            } else {
              await showInfo(notification.title, notification.body ?? undefined);
            }
          }
          await api.notifications.acknowledge(notification.notificationId);
        } catch {
          shownRef.current.delete(notification.notificationId);
        }
      }
    } catch {
      // Recovery polling is intentionally quiet; the next sync retries durable records.
    } finally {
      syncingRef.current = false;
    }
  }, [isAuthenticated, showInfo]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      shownRef.current.clear();
      return;
    }
    void syncDue();
    const timer = setInterval(() => void syncDue(), 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void syncDue();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [isAuthenticated, syncDue]);

  return children;
}
