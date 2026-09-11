import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useAppPopup } from '@/providers/PopupProvider';
import { api } from '@/services/api';
import {
  clearLocalCalendarReminders,
  clearLocalTaskReminders,
  clearLocalCheckupNotifications,
  ensureNotificationPermission,
  MEDITATION_COMPLETION_NOTIFICATION_KIND,
  syncLocalCheckupNotifications,
  LOCAL_CALENDAR_REMINDER_KIND,
  LOCAL_TASK_REMINDER_KIND,
  syncCalendarReminders as syncLocalCalendarReminders,
  syncTaskReminders as syncLocalTaskReminders,
  type CalendarReminderRecord,
  type TaskReminderRecord,
} from '@/services/localNotifications';
import type { ApplicationNotification, CalendarEvent, Task, UserPreferences } from '@/types/models';

interface NotificationContextValue {
  syncCalendarReminders: (events: CalendarEvent[]) => Promise<void>;
  syncTaskReminders: (tasks?: Task[]) => Promise<void>;
  syncCheckupNotifications: (preferences?: UserPreferences) => Promise<void>;
}

interface NotificationData {
  kind?: string;
  notificationId?: string;
  targetUrl?: string | null;
  type?: string;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);
const PUSH_REGISTRATION_RETRY_INTERVAL_MS = 5 * 60_000;

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const data = notification.request.content.data;
    const isMeditationCompletion = data?.kind === MEDITATION_COMPLETION_NOTIFICATION_KIND;
    const hideForegroundMeditationNotification = isMeditationCompletion && AppState.currentState === 'active';
    return {
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: !hideForegroundMeditationNotification,
      shouldShowList: !hideForegroundMeditationNotification,
    };
  },
});

function errorObject(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function isMissingFirebaseConfiguration(cause: unknown): boolean {
  const message = errorObject(cause).message.toLowerCase();
  return message.includes('unable to get firebase messaging instance')
    || message.includes('default firebaseapp is not initialized');
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const { showInfo } = useAppPopup();
  const syncingRef = useRef(false);
  const shownRef = useRef(new Set<string>());
  const calendarRemindersRef = useRef<CalendarReminderRecord[]>([]);
  const taskRemindersRef = useRef<TaskReminderRecord[]>([]);
  const localCheckupsEnabledRef = useRef(false);
  const pushRegistrationInFlightRef = useRef<Promise<void> | null>(null);
  const pushRegisteredRef = useRef(false);
  const remotePushUnavailableRef = useRef(false);

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

  const syncTaskReminders = useCallback(async (tasks?: Task[]) => {
    if (!isAuthenticated || Platform.OS !== 'android') return;
    try {
      const scheduledTasks = tasks ?? await api.tasks.scheduled();
      taskRemindersRef.current = await syncLocalTaskReminders(scheduledTasks);
    } catch (cause) {
      taskRemindersRef.current = [];
      console.error('Could not synchronize Android task reminders:', errorObject(cause));
    }
  }, [isAuthenticated]);

  const registerRemotePushToken = useCallback(async () => {
    if (!isAuthenticated
      || Platform.OS !== 'android'
      || Constants.expoConfig?.extra?.remotePushConfigured !== true
      || pushRegisteredRef.current
      || remotePushUnavailableRef.current) return;
    if (pushRegistrationInFlightRef.current) return pushRegistrationInFlightRef.current;

    const registration = (async () => {
      if (!await ensureNotificationPermission()) return;
      const projectId = Constants.easConfig?.projectId
        ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('Could not register mobile push notifications:', new Error('Expo project ID is missing'));
        return;
      }
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      await api.notifications.registerPushToken(token.data);
      pushRegisteredRef.current = true;
    })();
    pushRegistrationInFlightRef.current = registration;
    try {
      await registration;
    } catch (cause) {
      if (isMissingFirebaseConfiguration(cause)) {
        remotePushUnavailableRef.current = true;
        console.info('Remote push notifications are disabled because Firebase is not configured:', errorObject(cause));
      } else {
        console.error('Could not register mobile push notifications:', errorObject(cause));
      }
    } finally {
      if (pushRegistrationInFlightRef.current === registration) {
        pushRegistrationInFlightRef.current = null;
      }
    }
  }, [isAuthenticated]);

  const localReminderMatches = useCallback((notification: ApplicationNotification): boolean => {
    if (notification.type === 'MENTAL_STATE_CHECKUP') {
      return localCheckupsEnabledRef.current
        && !notification.notificationId.startsWith('mental-state-checkup-repeat-');
    }
    if (Platform.OS !== 'android') return false;
    if (notification.type === 'CALENDAR_EVENT' && notification.eventStart) {
      return calendarRemindersRef.current.some(record => record.eventStart === notification.eventStart
        && record.title === notification.title
        && record.allDay === Boolean(notification.allDay));
    }
    if (notification.type === 'TASK_REMINDER' && notification.taskId) {
      return taskRemindersRef.current.some(record => record.taskId === notification.taskId
        && record.title === notification.title
        && record.triggerAt === new Date(notification.scheduledAt).getTime());
    }
    return false;
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
          data: {
            notificationId: notification.notificationId,
            targetUrl: notification.targetUrl,
            type: notification.type,
          },
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

  const acknowledgePresentedNotifications = useCallback(async () => {
    if (!isAuthenticated || Platform.OS === 'web') return;
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      await Promise.all(presented.map(async notification => {
        const data = notification.request.content.data as NotificationData | null | undefined;
        if (!data?.notificationId) return;
        try {
          await api.notifications.acknowledge(data.notificationId);
        } catch (cause) {
          console.error(`Could not acknowledge presented notification ${data.notificationId}:`, errorObject(cause));
        }
      }));
    } catch (cause) {
      console.error('Could not inspect presented mobile notifications:', errorObject(cause));
    }
  }, [isAuthenticated]);

  const synchronizeAll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await acknowledgePresentedNotifications();
      const [checkupResult, eventsResult, tasksResult] = await Promise.allSettled([
        syncCheckupNotifications(),
        api.events.all(),
        api.tasks.scheduled(),
      ]);
      if (checkupResult.status === 'rejected') {
        console.error('Could not synchronize mental state check-ups:', errorObject(checkupResult.reason));
      }
      if (eventsResult.status === 'fulfilled') {
        await syncCalendarReminders(eventsResult.value);
      } else {
        console.error('Could not load calendar events for reminders:', errorObject(eventsResult.reason));
      }
      if (tasksResult.status === 'fulfilled') {
        await syncTaskReminders(tasksResult.value);
      } else {
        console.error('Could not load tasks for reminders:', errorObject(tasksResult.reason));
      }
      await syncDue();
    } catch (cause) {
      console.error('Could not synchronize mobile reminders:', errorObject(cause));
    }
  }, [acknowledgePresentedNotifications, isAuthenticated, syncCalendarReminders, syncCheckupNotifications, syncDue, syncTaskReminders]);

  useEffect(() => {
    // Auth starts without a user while the encrypted session is being restored.
    // Clearing native alarms during that window loses reminders across a cold start.
    if (authLoading) return;

    if (!isAuthenticated) {
      shownRef.current.clear();
      calendarRemindersRef.current = [];
      taskRemindersRef.current = [];
      localCheckupsEnabledRef.current = false;
      pushRegisteredRef.current = false;
      void clearLocalCalendarReminders();
      void clearLocalTaskReminders();
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
  }, [authLoading, isAuthenticated, synchronizeAll, syncDue]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || Platform.OS === 'web') {
      if (!isAuthenticated) pushRegisteredRef.current = false;
      return;
    }
    void registerRemotePushToken();
    const retryTimer = setInterval(() => void registerRemotePushToken(), PUSH_REGISTRATION_RETRY_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void registerRemotePushToken();
    });
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      pushRegisteredRef.current = false;
      void registerRemotePushToken();
    });
    return () => {
      clearInterval(retryTimer);
      appStateSubscription.remove();
      tokenSubscription.remove();
    };
  }, [authLoading, isAuthenticated, registerRemotePushToken]);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;
    const openNotification = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData | null | undefined;
      if (data?.notificationId) {
        void api.notifications.acknowledge(data.notificationId).catch(cause => {
          console.error(`Could not acknowledge opened notification ${data.notificationId}:`, errorObject(cause));
        });
      }
      if (data?.kind === LOCAL_CALENDAR_REMINDER_KIND || data?.targetUrl === '/calendar') {
        router.push('/(tabs)/calendar');
      } else if (data?.kind === LOCAL_TASK_REMINDER_KIND || data?.targetUrl === '/tasks' || data?.type === 'TASK_REMINDER') {
        router.push('/(tabs)/tasks');
      } else if (data?.targetUrl === '/mental-state' || data?.type === 'MENTAL_STATE_CHECKUP') {
        router.push('/mental-state');
      } else if (data?.kind === MEDITATION_COMPLETION_NOTIFICATION_KIND || data?.targetUrl === '/meditation') {
        router.push('/meditation');
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
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as NotificationData | null | undefined;
      if (!data?.notificationId) return;
      void api.notifications.acknowledge(data.notificationId).catch(cause => {
        console.error(`Could not acknowledge received notification ${data.notificationId}:`, errorObject(cause));
      });
    });
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) openNotification(response);
    }).catch(cause => {
      console.error('Could not read the opened notification response:', errorObject(cause));
    });
    return () => {
      subscription.remove();
      receivedSubscription.remove();
    };
  }, [isAuthenticated]);

  return (
    <NotificationContext.Provider value={{ syncCalendarReminders, syncTaskReminders, syncCheckupNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}
