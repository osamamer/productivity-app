import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { expandCalendarEvent, type CalendarEventOccurrence } from '@/lib/calendarRecurrence';
import type { CalendarEvent, UserPreferences } from '@/types/models';

export const REMINDER_CHANNEL_ID = 'default';
export const LOCAL_CALENDAR_REMINDER_KIND = 'calendar-event-reminder';
export const LOCAL_CHECKUP_KIND = 'mental-state-checkup';
export const CHECKUP_NOTIFICATION_TITLE = 'Check-Up';
export const CHECKUP_NOTIFICATION_BODY = 'Time to check what your state is.';
export const CHECKUP_NOTIFICATION_TARGET = '/mental-state';
export const DEFAULT_CHECKUP_INTERVAL_MINUTES = 180;
export const DEFAULT_CHECKUP_START_TIME = '09:00';
export const DEFAULT_CHECKUP_TIMES_PER_DAY = 5;

const LOCAL_NOTIFICATION_PREFIX = 'calendar-event-reminder-';
const LOCAL_CHECKUP_PREFIX = 'mental-state-checkup-';
const REMINDER_LEDGER_KEY = 'solife.calendar-local-reminder-ledger';
const REMINDER_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;
const RECENT_REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_LEDGER_SIZE = 500;

export type CalendarReminderSyncStatus = 'not-needed' | 'granted' | 'denied' | 'unavailable' | 'unsupported';

export interface CalendarReminderRecord {
  eventId: string;
  eventStart: string;
  title: string;
  allDay: boolean;
  triggerAt: number;
}

export interface CalendarReminderSyncResult {
  status: CalendarReminderSyncStatus;
  reminders: CalendarReminderRecord[];
}

interface LocalReminderData {
  kind: typeof LOCAL_CALENDAR_REMINDER_KIND;
  eventId: string;
  eventStart: string;
  allDay: boolean;
  triggerAt: number;
}

interface LocalCheckupData {
  kind: typeof LOCAL_CHECKUP_KIND;
  targetUrl: typeof CHECKUP_NOTIFICATION_TARGET;
  type: 'MENTAL_STATE_CHECKUP';
  hour: number;
  minute: number;
}

let permissionRequestAttempted = false;
let syncQueue: Promise<unknown> = Promise.resolve();

function logNotificationError(context: string, cause: unknown): void {
  console.error(`${context}:`, cause instanceof Error ? cause : new Error(String(cause)));
}

function recordKey(record: Pick<CalendarReminderRecord, 'eventId' | 'eventStart'>): string {
  return `${record.eventId}\u0000${record.eventStart}`;
}

function notificationId(eventId: string, eventStart: string): string {
  return `${LOCAL_NOTIFICATION_PREFIX}${encodeURIComponent(eventId)}-${encodeURIComponent(eventStart)}`;
}

function isLocalReminderData(value: unknown): value is LocalReminderData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LocalReminderData>;
  return data.kind === LOCAL_CALENDAR_REMINDER_KIND
    && typeof data.eventId === 'string'
    && typeof data.eventStart === 'string'
    && typeof data.allDay === 'boolean'
    && typeof data.triggerAt === 'number';
}

function dataFromRequest(request: Notifications.NotificationRequest): LocalReminderData | null {
  return isLocalReminderData(request.content.data) ? request.content.data : null;
}

function isLocalCheckupData(value: unknown): value is LocalCheckupData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LocalCheckupData>;
  return data.kind === LOCAL_CHECKUP_KIND
    && data.targetUrl === CHECKUP_NOTIFICATION_TARGET
    && data.type === 'MENTAL_STATE_CHECKUP'
    && typeof data.hour === 'number'
    && (data.minute === undefined || typeof data.minute === 'number');
}

function checkupDataFromRequest(request: Notifications.NotificationRequest): LocalCheckupData | null {
  if (!isLocalCheckupData(request.content.data)) return null;
  return { ...request.content.data, minute: request.content.data.minute ?? 0 };
}

function checkupNotificationId(hour: number, minute: number): string {
  return `${LOCAL_CHECKUP_PREFIX}${hour * 60 + minute}`;
}

function checkupRequestMatches(request: Notifications.NotificationRequest, hour: number, minute: number): boolean {
  const data = checkupDataFromRequest(request);
  return data !== null
    && data.hour === hour
    && data.minute === minute
    && request.content.title === CHECKUP_NOTIFICATION_TITLE
    && request.content.body === CHECKUP_NOTIFICATION_BODY;
}

function timeParts(value: string | null | undefined): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})/.exec(value ?? '');
  if (!match) return { hour: 9, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function checkupTimes(preferences: UserPreferences): { hour: number; minute: number }[] {
  const start = timeParts(preferences.checkupStartTime || DEFAULT_CHECKUP_START_TIME);
  const interval = preferences.checkupIntervalMinutes || DEFAULT_CHECKUP_INTERVAL_MINUTES;
  const count = preferences.checkupTimesPerDay || DEFAULT_CHECKUP_TIMES_PER_DAY;
  const startMinute = start.hour * 60 + start.minute;

  return Array.from({ length: count }, (_, index) => startMinute + index * interval)
    .filter(totalMinutes => totalMinutes < 24 * 60)
    .map(totalMinutes => ({
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60,
    }));
}

function requestMatches(request: Notifications.NotificationRequest, expected: CalendarReminderRecord): boolean {
  const data = dataFromRequest(request);
  return data !== null
    && data.eventId === expected.eventId
    && data.eventStart === expected.eventStart
    && data.allDay === expected.allDay
    && data.triggerAt === expected.triggerAt
    && request.content.title === expected.title;
}

function validLedgerRecords(value: unknown): CalendarReminderRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CalendarReminderRecord => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Partial<CalendarReminderRecord>;
    return typeof record.eventId === 'string'
      && typeof record.eventStart === 'string'
      && typeof record.title === 'string'
      && typeof record.allDay === 'boolean'
      && typeof record.triggerAt === 'number';
  });
}

async function readLedger(): Promise<CalendarReminderRecord[]> {
  try {
    const stored = await AsyncStorage.getItem(REMINDER_LEDGER_KEY);
    if (!stored) return [];
    return validLedgerRecords(JSON.parse(stored));
  } catch (cause) {
    logNotificationError('Could not read local reminder ledger', cause);
    return [];
  }
}

async function writeLedger(records: CalendarReminderRecord[]): Promise<void> {
  try {
    const unique = new Map(records.map(record => [recordKey(record), record]));
    await AsyncStorage.setItem(REMINDER_LEDGER_KEY, JSON.stringify([...unique.values()].slice(-MAX_LEDGER_SIZE)));
  } catch (cause) {
    logNotificationError('Could not persist local reminder ledger', cause);
  }
}

function pruneLedger(records: CalendarReminderRecord[], now: number): CalendarReminderRecord[] {
  return records.filter(record => record.triggerAt >= now - RECENT_REMINDER_WINDOW_MS);
}

function calendarParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function zonedMidnight(dateKey: string, timeZone: string): Date {
  const parts = calendarParts(dateKey);
  if (!parts) return new Date(`${dateKey}T00:00:00`);

  const localTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day);
  let timestamp = localTimestamp;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(timestamp));
      const part = (type: string) => Number(formatted.find(item => item.type === type)?.value ?? 0);
      const representedTimestamp = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
      timestamp += localTimestamp - representedTimestamp;
    }
  } catch (cause) {
    logNotificationError(`Could not resolve event time zone ${timeZone}`, cause);
    return new Date(`${dateKey}T00:00:00`);
  }
  return new Date(timestamp);
}

function occurrenceStart(occurrence: CalendarEventOccurrence, event: CalendarEvent): Date {
  if (!event.allDay) return new Date(occurrence.start);
  return zonedMidnight(occurrence.start, event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
}

function eventOccurrences(event: CalendarEvent, now: number): CalendarEventOccurrence[] {
  const rangeStart = new Date(now - MAX_REMINDER_MINUTES * 60 * 1000);
  const rangeEnd = new Date(now + REMINDER_HORIZON_MS);
  return expandCalendarEvent(event, rangeStart, rangeEnd);
}

function expectedReminders(event: CalendarEvent, now: number): CalendarReminderRecord[] {
  if (event.reminderMinutesBefore === null) return [];
  const title = event.title.trim() || 'Calendar event';
  const records: CalendarReminderRecord[] = [];

  eventOccurrences(event, now).forEach(occurrence => {
    const start = occurrenceStart(occurrence, event);
    if (Number.isNaN(start.getTime())) return;
    const triggerAt = start.getTime() - event.reminderMinutesBefore! * 60 * 1000;
    if (triggerAt <= now) return;
    records.push({
      eventId: event.id,
      eventStart: start.toISOString(),
      title,
      allDay: event.allDay,
      triggerAt,
    });
  });

  return records;
}

async function cancelRequests(requests: Notifications.NotificationRequest[]): Promise<boolean> {
  let successful = true;
  await Promise.all(requests.map(async request => {
    try {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    } catch (cause) {
      successful = false;
      logNotificationError(`Could not cancel local reminder ${request.identifier}`, cause);
    }
  }));
  return successful;
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
}

export type CheckupNotificationSyncStatus = 'granted' | 'denied' | 'disabled' | 'unavailable' | 'unsupported';

export async function syncLocalCheckupNotifications(preferences: UserPreferences): Promise<CheckupNotificationSyncStatus> {
  return queued(async () => {
    if (Platform.OS === 'web') return 'unsupported';

    let scheduled: Notifications.NotificationRequest[];
    try {
      scheduled = await Notifications.getAllScheduledNotificationsAsync();
    } catch (cause) {
      logNotificationError('Could not inspect scheduled mental state check-ups', cause);
      return 'unavailable';
    }

    const managed = scheduled.filter(request => checkupDataFromRequest(request) !== null);
    if (preferences.checkupNotificationsEnabled === false) {
      await cancelRequests(managed);
      return 'disabled';
    }
    if (!await ensureNotificationPermission()) {
      await cancelRequests(managed);
      return 'denied';
    }

    const existingById = new Map(managed.map(request => [request.identifier, request]));
    const expectedTimes = checkupTimes(preferences);
    const expectedIds = new Set(expectedTimes.map(({ hour, minute }) => checkupNotificationId(hour, minute)));
    const cancellationSuccessful = await cancelRequests(
      managed.filter(request => !expectedIds.has(request.identifier)
        || !checkupRequestMatches(
          request,
          checkupDataFromRequest(request)!.hour,
          checkupDataFromRequest(request)!.minute,
        )),
    );
    let schedulingSuccessful = cancellationSuccessful;

    for (const { hour, minute } of expectedTimes) {
      const id = checkupNotificationId(hour, minute);
      const existing = existingById.get(id);
      if (existing && checkupRequestMatches(existing, hour, minute)) continue;

      try {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: CHECKUP_NOTIFICATION_TITLE,
            body: CHECKUP_NOTIFICATION_BODY,
            sound: true,
            data: {
              kind: LOCAL_CHECKUP_KIND,
              targetUrl: CHECKUP_NOTIFICATION_TARGET,
              type: 'MENTAL_STATE_CHECKUP',
              hour,
              minute,
            } satisfies LocalCheckupData,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: REMINDER_CHANNEL_ID,
          },
        });
      } catch (cause) {
        schedulingSuccessful = false;
        logNotificationError(`Could not schedule mental state check-up at ${hour}:${String(minute).padStart(2, '0')}`, cause);
      }
    }

    return schedulingSuccessful ? 'granted' : 'unavailable';
  });
}

async function reconcileCalendarReminders(events: CalendarEvent[]): Promise<CalendarReminderSyncResult> {
  const now = Date.now();
  let scheduled: Notifications.NotificationRequest[];
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch (cause) {
    logNotificationError('Could not inspect scheduled Android reminders', cause);
    return { status: 'unavailable', reminders: [] };
  }

  const managed = scheduled.filter(request => dataFromRequest(request) !== null);
  const ledger = pruneLedger(await readLedger(), now);
  const expected = events.flatMap(event => expectedReminders(event, now));
  const expectedById = new Map(expected.map(record => [notificationId(record.eventId, record.eventStart), record]));
  const existingById = new Map(managed.map(request => [request.identifier, request]));
  const recordsToCancel = managed.filter(request => {
    const match = expectedById.get(request.identifier);
    return !match || !requestMatches(request, match);
  });
  const cancellationSuccessful = await cancelRequests(recordsToCancel);
  const scheduledRecords: CalendarReminderRecord[] = [];
  let schedulingSuccessful = cancellationSuccessful;

  for (const record of expected) {
    const id = notificationId(record.eventId, record.eventStart);
    const existing = existingById.get(id);
    if (existing && requestMatches(existing, record)) {
      scheduledRecords.push(record);
      continue;
    }
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: record.title,
          body: 'Event reminder',
          sound: true,
          data: {
            kind: LOCAL_CALENDAR_REMINDER_KIND,
            eventId: record.eventId,
            eventStart: record.eventStart,
            allDay: record.allDay,
            triggerAt: record.triggerAt,
          } satisfies LocalReminderData,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(record.triggerAt),
          channelId: REMINDER_CHANNEL_ID,
        },
      });
      scheduledRecords.push(record);
    } catch (cause) {
      schedulingSuccessful = false;
      logNotificationError(`Could not schedule local reminder for event ${record.eventId}`, cause);
    }
  }

  const recentLedger = ledger.filter(record => record.triggerAt <= now);
  await writeLedger([...recentLedger, ...scheduledRecords]);
  const knownRecords = [...recentLedger, ...scheduledRecords];
  return {
    status: schedulingSuccessful ? 'granted' : 'unavailable',
    reminders: [...new Map(knownRecords.map(record => [recordKey(record), record])).values()],
  };
}

async function queued<T>(work: () => Promise<T>): Promise<T> {
  const next = syncQueue.then(work, work);
  syncQueue = next.catch(() => undefined);
  return next;
}

export function syncCalendarReminders(events: CalendarEvent[]): Promise<CalendarReminderSyncResult> {
  return queued(async () => {
    if (Platform.OS !== 'android') return { status: 'unsupported', reminders: [] };
    const hasReminders = events.some(event => event.reminderMinutesBefore !== null);
    if (!hasReminders) {
      let scheduled: Notifications.NotificationRequest[] = [];
      try {
        scheduled = await Notifications.getAllScheduledNotificationsAsync();
      } catch (cause) {
        logNotificationError('Could not inspect scheduled Android reminders', cause);
      }
      await cancelRequests(scheduled.filter(request => dataFromRequest(request) !== null));
      await AsyncStorage.removeItem(REMINDER_LEDGER_KEY).catch(cause => logNotificationError('Could not clear local reminder ledger', cause));
      return { status: 'not-needed', reminders: [] };
    }
    if (!await ensureNotificationPermission()) {
      let scheduled: Notifications.NotificationRequest[] = [];
      try {
        scheduled = await Notifications.getAllScheduledNotificationsAsync();
      } catch (cause) {
        logNotificationError('Could not inspect scheduled Android reminders after permission denial', cause);
      }
      await cancelRequests(scheduled.filter(request => dataFromRequest(request) !== null));
      return { status: 'denied', reminders: [] };
    }
    return reconcileCalendarReminders(events);
  });
}

export function clearLocalCalendarReminders(): Promise<void> {
  return queued(async () => {
    if (Platform.OS === 'android') {
      try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        await cancelRequests(scheduled.filter(request => dataFromRequest(request) !== null));
      } catch (cause) {
        logNotificationError('Could not clear scheduled Android reminders', cause);
      }
    }
    await AsyncStorage.removeItem(REMINDER_LEDGER_KEY).catch(cause => logNotificationError('Could not clear local reminder ledger', cause));
  });
}

export function clearLocalCheckupNotifications(): Promise<void> {
  return queued(async () => {
    if (Platform.OS === 'web') return;
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await cancelRequests(scheduled.filter(request => checkupDataFromRequest(request) !== null));
    } catch (cause) {
      logNotificationError('Could not clear scheduled mental state check-ups', cause);
    }
  });
}
