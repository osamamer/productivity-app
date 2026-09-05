import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useAppPopup } from '@/providers/PopupProvider';
import { api } from '@/services/api';
import {
  clearLocalCalendarReminders,
  clearLocalCheckupNotifications,
  ensureNotificationPermission,
  syncLocalCheckupNotifications,
  LOCAL_CALENDAR_REMINDER_KIND,
  syncCalendarReminders as syncLocalCalendarReminders,
  type CalendarReminderRecord,
} from '@/services/localNotifications';
import type { ApplicationNotification, CalendarEvent, UserPreferences } from '@/types/models';

interface NotificationContextValue {
  syncCalendarReminders: (events: CalendarEvent[]) => Promise<void>;
  syncCheckupNotifications: (preferences?: UserPreferences) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function errorObject(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const { showInfo } = useAppPopup();
  const syncingRef = useRef(false);
  const shownRef = useRef(new Set<string>());
  const calendarRemindersRef = useRef<CalendarReminderRecord[]>([]);
  const localCheckupsEnabledRef = useRef(false);

  const syncCalendarReminders = useCallback(async (events: CalendarEvent[]) => {
    if (!isAuthenticated) return;
    try {
      const result = await syncLocalCalendarReminders(events);
      calendarRemindersRef.current = result.reminders;
    } catch (cause) {
      calendarRemindersRef.current = [];
      console.error('Could not synchronize Android calendar reminders:', errorObject(cause));
    }
  }, [isAuthenticated]);

  const syncCheckupNotifications = useCallback(async (preferences?: UserPreferences) => {
    if (!isAuthenticated) return;
    const currentPreferences = preferences ?? await api.preferences.get();
    const status = await syncLocalCheckupNotifications(currentPreferences);
    localCheckupsEnabledRef.current = status === 'granted';
  }, [isAuthenticated]);

  const localReminderMatches = useCallback((notification: ApplicationNotification): boolean => {
    if (notification.type === 'MENTAL_STATE_CHECKUP') {
      return localCheckupsEnabledRef.current;
    }
    if (Platform.OS !== 'android' || notification.type !== 'CALENDAR_EVENT' || !notification.eventStart) return false;
    return calendarRemindersRef.current.some(record => record.eventStart === notification.eventStart
      && record.title === notification.title
      && record.allDay === Boolean(notification.allDay));
  }, []);

  const presentDueNotification = useCallback(async (notification: ApplicationNotification) => {
    if (localReminderMatches(notification)) {
      await api.notifications.acknowledge(notification.notificationId);
      return;
    }

    if (Platform.OS === 'web') {
      await showInfo(notification.title, notification.body ?? undefined);
      await api.notifications.acknowledge(notification.notificationId);
      return;
    }

    if (await ensureNotificationPermission()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body ?? undefined,
          data: { targetUrl: notification.targetUrl, type: notification.type },
          sound: true,
        },
        trigger: null,
      });
    } else {
      await showInfo(notification.title, notification.body ?? undefined);
    }
    await api.notifications.acknowledge(notification.notificationId);
  }, [localReminderMatches, showInfo]);

  const syncDue = useCallback(async () => {
    if (!isAuthenticated || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const due = await api.notifications.due();
      for (const notification of due) {
        if (shownRef.current.has(notification.notificationId)) continue;
        shownRef.current.add(notification.notificationId);
        try {
          await presentDueNotification(notification);
        } catch (cause) {
          console.error(`Could not present notification ${notification.notificationId}:`, errorObject(cause));
          shownRef.current.delete(notification.notificationId);
        }
      }
    } catch (cause) {
      console.error('Could not synchronize due notifications:', errorObject(cause));
    } finally {
      syncingRef.current = false;
    }
  }, [isAuthenticated, presentDueNotification]);

  const synchronizeAll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await syncCheckupNotifications();
      const events = await api.events.all();
      await syncCalendarReminders(events);
      await syncDue();
    } catch (cause) {
      console.error('Could not synchronize mobile reminders:', errorObject(cause));
    }
  }, [isAuthenticated, syncCalendarReminders, syncCheckupNotifications, syncDue]);

  useEffect(() => {
    if (!isAuthenticated) {
      shownRef.current.clear();
      calendarRemindersRef.current = [];
      localCheckupsEnabledRef.current = false;
      void clearLocalCalendarReminders();
      void clearLocalCheckupNotifications();
      return;
    }

    void synchronizeAll();
    const dueTimer = setInterval(() => void syncDue(), 60_000);
    const calendarTimer = setInterval(() => void synchronizeAll(), 5 * 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void synchronizeAll();
    });
    return () => {
      clearInterval(dueTimer);
      clearInterval(calendarTimer);
      subscription.remove();
    };
  }, [isAuthenticated, synchronizeAll, syncDue]);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;
    const openNotification = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as { kind?: string; targetUrl?: string | null; type?: string } | null | undefined;
      if (data?.kind === LOCAL_CALENDAR_REMINDER_KIND || data?.targetUrl === '/calendar') {
        router.push('/(tabs)/calendar');
      } else if (data?.targetUrl === '/mental-state' || data?.type === 'MENTAL_STATE_CHECKUP') {
        router.push('/mental-state');
      } else if (data?.targetUrl === '/') {
        router.push('/(tabs)');
      } else {
        return;
      }
      void Notifications.clearLastNotificationResponseAsync().catch(cause => {
        console.error('Could not clear the opened notification response:', errorObject(cause));
      });
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) openNotification(response);
    }).catch(cause => {
      console.error('Could not read the opened notification response:', errorObject(cause));
    });
    return () => subscription.remove();
  }, [isAuthenticated]);

  return (
    <NotificationContext.Provider value={{ syncCalendarReminders, syncCheckupNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}
