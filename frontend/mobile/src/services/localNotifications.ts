import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REMINDER_CHANNEL_ID = 'default';
export const LOCAL_CALENDAR_REMINDER_KIND = 'calendar-event-reminder';
export const LOCAL_TASK_REMINDER_KIND = 'task-reminder';
export const LOCAL_CHECKUP_KIND = 'mental-state-checkup';
export const MEDITATION_COMPLETION_NOTIFICATION_KIND = 'meditation-completion';

const REMINDER_LEDGER_KEY = 'solife.calendar-local-reminder-ledger';
const TASK_REMINDER_LEDGER_KEY = 'solife.task-local-reminder-ledger';
const MEDITATION_COMPLETION_LEDGER_PREFIX = 'solife.meditation-completion-';

let permissionRequestAttempted = false;
let permissionRequestInFlight: Promise<boolean> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

function logNotificationError(context: string, cause: unknown): void {
  console.error(`${context}:`, cause instanceof Error ? cause : new Error(String(cause)));
}

function isReplacedLocalNotification(request: Notifications.NotificationRequest): boolean {
  const value = request.content.data;
  if (!value || typeof value !== 'object') return false;
  const data = value as { kind?: unknown; notificationId?: unknown };
  return data.kind === LOCAL_CALENDAR_REMINDER_KIND
    || data.kind === LOCAL_TASK_REMINDER_KIND
    || data.kind === LOCAL_CHECKUP_KIND
    || data.kind === MEDITATION_COMPLETION_NOTIFICATION_KIND
    || typeof data.notificationId === 'string';
}

async function cancelRequests(requests: Notifications.NotificationRequest[]): Promise<void> {
  await Promise.all(requests.map(async request => {
    try {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    } catch (cause) {
      logNotificationError(`Could not cancel legacy local notification ${request.identifier}`, cause);
    }
  }));
}

async function clearLegacyLedgers(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const obsolete = keys.filter(key => key === REMINDER_LEDGER_KEY
      || key === TASK_REMINDER_LEDGER_KEY
      || key.startsWith(MEDITATION_COMPLETION_LEDGER_PREFIX));
    if (obsolete.length > 0) await AsyncStorage.multiRemove(obsolete);
  } catch (cause) {
    logNotificationError('Could not clear legacy local notification ledgers', cause);
  }
}

async function configureAndroidChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (permissionRequestInFlight) return permissionRequestInFlight;

  const request = (async () => {
    try {
      if (Platform.OS === 'android') await configureAndroidChannel();
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (permissionRequestAttempted) return false;
      permissionRequestAttempted = true;
      return (await Notifications.requestPermissionsAsync()).granted;
    } catch (cause) {
      logNotificationError('Could not prepare mobile notifications', cause);
      return false;
    }
  })();
  permissionRequestInFlight = request;
  try {
    return await request;
  } finally {
    if (permissionRequestInFlight === request) permissionRequestInFlight = null;
  }
}

/** Removes schedules created by versions that delivered reminders locally. */
export function clearLegacyLocalNotifications(): Promise<void> {
  return queued(async () => {
    if (Platform.OS !== 'web') {
      try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        await cancelRequests(scheduled.filter(isReplacedLocalNotification));
      } catch (cause) {
        logNotificationError('Could not clear legacy local notifications', cause);
      }
    }
    await clearLegacyLedgers();
  });
}

async function queued<T>(work: () => Promise<T>): Promise<T> {
  const next = operationQueue.then(work, work);
  operationQueue = next.catch(() => undefined);
  return next;
}
