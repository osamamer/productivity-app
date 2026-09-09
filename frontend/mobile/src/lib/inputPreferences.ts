import AsyncStorage from '@react-native-async-storage/async-storage';

export type RememberedStatInputType = 'TIME' | 'DURATION';

export interface EventTimePreferences {
  startTime?: string;
  endTime?: string;
}

const EVENT_TIME_STORAGE_SUFFIX = 'event-time-preferences';
const STAT_INPUT_STORAGE_SUFFIX = 'stat-input-preferences';

function userStorageKey(userId: string | undefined, suffix: string): string {
  return `solife.${userId ?? 'signed-out'}.${suffix}`;
}

function isTimeValue(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
}

function isStatValue(value: unknown, type: RememberedStatInputType): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && (type === 'TIME' ? Number.isInteger(value) && value >= 0 && value < 24 * 60 : value >= 0);
}

export async function readEventTimePreferences(userId: string | undefined): Promise<EventTimePreferences> {
  try {
    const stored = await AsyncStorage.getItem(userStorageKey(userId, EVENT_TIME_STORAGE_SUFFIX));
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Partial<EventTimePreferences>;
    return {
      startTime: isTimeValue(parsed.startTime) ? parsed.startTime : undefined,
      endTime: isTimeValue(parsed.endTime) ? parsed.endTime : undefined,
    };
  } catch (cause) {
    console.warn('Could not read remembered mobile event input preferences:', cause);
    return {};
  }
}

export async function saveEventTimePreferences(
  userId: string | undefined,
  startTime: string,
  endTime: string,
): Promise<void> {
  if (!isTimeValue(startTime) || !isTimeValue(endTime)) return;
  try {
    await AsyncStorage.setItem(
      userStorageKey(userId, EVENT_TIME_STORAGE_SUFFIX),
      JSON.stringify({ startTime, endTime }),
    );
  } catch (cause) {
    console.warn('Could not save remembered mobile event input preferences:', cause);
  }
}

function statStorageKey(userId: string | undefined, definitionId: string, type: RememberedStatInputType): string {
  return `${userStorageKey(userId, STAT_INPUT_STORAGE_SUFFIX)}.${encodeURIComponent(type)}.${encodeURIComponent(definitionId)}`;
}

export async function readStatInputPreference(
  userId: string | undefined,
  definitionId: string,
  type: RememberedStatInputType,
): Promise<number | null> {
  try {
    const stored = await AsyncStorage.getItem(statStorageKey(userId, definitionId, type));
    const value = stored === null ? null : Number(stored);
    return isStatValue(value, type) ? value : null;
  } catch (cause) {
    console.warn('Could not read remembered mobile stat input preference:', cause);
    return null;
  }
}

export async function saveStatInputPreference(
  userId: string | undefined,
  definitionId: string,
  type: RememberedStatInputType,
  value: number,
): Promise<void> {
  if (!isStatValue(value, type)) return;
  try {
    await AsyncStorage.setItem(statStorageKey(userId, definitionId, type), String(value));
  } catch (cause) {
    console.warn('Could not save remembered mobile stat input preference:', cause);
  }
}
