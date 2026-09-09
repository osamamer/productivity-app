import { getAuthCacheScope } from './authHeaders';

export type RememberedStatInputType = 'TIME' | 'DURATION';

export interface EventTimePreferences {
    startTime?: string;
    endTime?: string;
}

const EVENT_TIME_STORAGE_PREFIX = 'solife.event-time-preferences';
const STAT_INPUT_STORAGE_PREFIX = 'solife.stat-input-preferences';

function storageKey(prefix: string): string {
    return `${prefix}.${getAuthCacheScope()}`;
}

function readObject<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = window.localStorage.getItem(key);
        return stored ? JSON.parse(stored) as T : null;
    } catch (cause) {
        console.warn('Could not read remembered input preferences:', cause);
        return null;
    }
}

function writeObject(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (cause) {
        console.warn('Could not save remembered input preferences:', cause);
    }
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

export function readEventTimePreferences(): EventTimePreferences {
    const stored = readObject<Partial<EventTimePreferences>>(storageKey(EVENT_TIME_STORAGE_PREFIX));
    return {
        startTime: isTimeValue(stored?.startTime) ? stored.startTime : undefined,
        endTime: isTimeValue(stored?.endTime) ? stored.endTime : undefined,
    };
}

export function saveEventTimePreferences(startTime: string, endTime: string): void {
    if (!isTimeValue(startTime) || !isTimeValue(endTime)) return;
    writeObject(storageKey(EVENT_TIME_STORAGE_PREFIX), { startTime, endTime });
}

export function readStatInputPreference(
    definitionId: string,
    type: RememberedStatInputType,
): number | null {
    const stored = readObject<Record<string, unknown>>(storageKey(STAT_INPUT_STORAGE_PREFIX));
    return isStatValue(stored?.[`${type}:${definitionId}`], type)
        ? stored![`${type}:${definitionId}`] as number
        : null;
}

export function saveStatInputPreference(
    definitionId: string,
    type: RememberedStatInputType,
    value: number,
): void {
    if (!isStatValue(value, type)) return;
    const key = storageKey(STAT_INPUT_STORAGE_PREFIX);
    const stored = readObject<Record<string, unknown>>(key) ?? {};
    writeObject(key, { ...stored, [`${type}:${definitionId}`]: value });
}
