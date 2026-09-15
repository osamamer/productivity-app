import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { PropsWithChildren, useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/services/api';
import {
  clearLegacyLocalNotifications,
  ensureNotificationPermission,
  LOCAL_CALENDAR_REMINDER_KIND,
  LOCAL_TASK_REMINDER_KIND,
  MEDITATION_COMPLETION_NOTIFICATION_KIND,
} from '@/services/localNotifications';

interface NotificationData {
  kind?: string;
  notificationId?: string;
  targetUrl?: string | null;
  type?: string;
}

const PUSH_REGISTRATION_RETRY_INTERVAL_MS = 5 * 60_000;

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const data = notification.request.content.data;
    const isMeditationCompletion = data?.kind === MEDITATION_COMPLETION_NOTIFICATION_KIND
      || data?.type === 'MEDITATION_COMPLETED';
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
  const acknowledgedRef = useRef(new Set<string>());
  const pushRegistrationInFlightRef = useRef<Promise<void> | null>(null);
  const pushRegisteredRef = useRef(false);
  const remotePushUnavailableRef = useRef(false);

  const acknowledgeNotification = useCallback(async (notificationId: string) => {
    if (acknowledgedRef.current.has(notificationId)) return;
    try {
      await api.notifications.acknowledge(notificationId);
      acknowledgedRef.current.add(notificationId);
    } catch (cause) {
      acknowledgedRef.current.delete(notificationId);
      throw cause;
    }
  }, []);

  const acknowledgePresentedNotifications = useCallback(async () => {
    if (!isAuthenticated || Platform.OS === 'web') return;
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      const notificationIds = [...new Set(presented.map(notification => {
        const data = notification.request.content.data as NotificationData | null | undefined;
        return data?.notificationId;
      }).filter((id): id is string => Boolean(id)))];
      await Promise.all(notificationIds.map(async notificationId => {
        try {
          await acknowledgeNotification(notificationId);
        } catch (cause) {
          console.error(`Could not acknowledge presented notification ${notificationId}:`, errorObject(cause));
        }
      }));
    } catch (cause) {
      console.error('Could not inspect presented mobile notifications:', errorObject(cause));
    }
  }, [acknowledgeNotification, isAuthenticated]);

  const registerRemotePushToken = useCallback(async () => {
    if (!isAuthenticated
      || Platform.OS !== 'android'
      || Constants.expoConfig?.extra?.remotePushConfigured !== true
      || pushRegisteredRef.current
      || remotePushUnavailableRef.current) return;
    if (pushRegistrationInFlightRef.current) return pushRegistrationInFlightRef.current;

    const registration = (async () => {
      // Finish removing schedules from older builds before registering the token
      // that enables the first remote push for this installation.
      await clearLegacyLocalNotifications();
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

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      acknowledgedRef.current.clear();
      pushRegisteredRef.current = false;
      remotePushUnavailableRef.current = false;
      void clearLegacyLocalNotifications();
      return;
    }

    // Remove alarms from versions that used the local calendar, task, check-up,
    // or meditation channels before the first remote push can arrive.
    void clearLegacyLocalNotifications();
    void acknowledgePresentedNotifications();
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void acknowledgePresentedNotifications();
    });
    return () => appStateSubscription.remove();
  }, [acknowledgePresentedNotifications, authLoading, isAuthenticated]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || Platform.OS === 'web') {
      if (!isAuthenticated) {
        pushRegisteredRef.current = false;
        remotePushUnavailableRef.current = false;
      }
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
        void acknowledgeNotification(data.notificationId).catch(cause => {
          console.error(`Could not acknowledge opened notification ${data.notificationId}:`, errorObject(cause));
        });
      }
      if (data?.kind === LOCAL_CALENDAR_REMINDER_KIND || data?.targetUrl === '/calendar' || data?.type === 'CALENDAR_EVENT') {
        router.push('/(tabs)/calendar');
      } else if (data?.kind === LOCAL_TASK_REMINDER_KIND || data?.targetUrl === '/tasks' || data?.type === 'TASK_REMINDER') {
        router.push('/(tabs)/tasks');
      } else if (data?.targetUrl === '/mental-state' || data?.type === 'MENTAL_STATE_CHECKUP') {
        router.push('/mental-state');
      } else if (data?.kind === MEDITATION_COMPLETION_NOTIFICATION_KIND
        || data?.targetUrl === '/meditation'
        || data?.type === 'MEDITATION_COMPLETED') {
        router.push('/meditation');
      } else if (data?.targetUrl === '/' || data?.type?.startsWith('POMODORO_')) {
        router.push('/(tabs)');
      } else {
        return;
      }
      void Notifications.clearLastNotificationResponseAsync().catch(cause => {
        console.error('Could not clear the opened notification response:', errorObject(cause));
      });
    };

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as NotificationData | null | undefined;
      if (!data?.notificationId) return;
      void acknowledgeNotification(data.notificationId).catch(cause => {
        console.error(`Could not acknowledge received notification ${data.notificationId}:`, errorObject(cause));
      });
    });
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) openNotification(response);
    }).catch(cause => {
      console.error('Could not read the opened notification response:', errorObject(cause));
    });
    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [acknowledgeNotification, isAuthenticated]);

  return <>{children}</>;
}
