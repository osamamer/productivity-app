import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { TtlCache } from '../cache/ttlCache';
import { userService } from './userService';
import { getRuntimeUserPreference, getRuntimeUserPreferences, updateRuntimeUserPreferences } from '../userPreferenceStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type PomodoroDurationUnit = 'minutes' | 'seconds';
export const POMODORO_DEV_SECONDS_MODE_STORAGE_KEY = 'pomodoroDevSecondsMode';
const POMODORO_FORM_STORAGE_PREFIX = 'solife.pomodoro-form';
const POMODORO_FORM_UPDATED_EVENT = 'solife:pomodoro-form-updated';

export interface PomodoroConfig {
    secondsMode: boolean;
    durationUnit: PomodoroDurationUnit;
    defaultFocusDuration: number;
    defaultShortBreakDuration: number;
    defaultLongBreakDuration: number;
}

export interface PomodoroFormValues {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    numFocuses: number;
    longBreakCooldown: number;
}

export const NORMAL_POMODORO_CONFIG: PomodoroConfig = {
    secondsMode: false,
    durationUnit: 'minutes',
    defaultFocusDuration: 25,
    defaultShortBreakDuration: 5,
    defaultLongBreakDuration: 15,
};

const DEV_POMODORO_CONFIG: PomodoroConfig = {
    secondsMode: true,
    durationUnit: 'seconds',
    defaultFocusDuration: 10,
    defaultShortBreakDuration: 10,
    defaultLongBreakDuration: 10,
};

const DEFAULT_NUM_FOCUSES = 4;
export const DEFAULT_LONG_BREAK_COOLDOWN = 4;

const POMODORO_CONFIG_TTL_MS = 5 * 60 * 1000;
const pomodoroConfigCache = new TtlCache<PomodoroConfig>({ ttlMs: POMODORO_CONFIG_TTL_MS, maxEntries: 4 });
const pomodoroConfigRequests = new Map<string, Promise<PomodoroConfig>>();
let pendingFormPreferenceUpdate: Partial<{
    pomodoroFocusDuration: number;
    pomodoroShortBreakDuration: number;
    pomodoroLongBreakDuration: number;
    pomodoroNumFocuses: number;
    pomodoroLongBreakCooldown: number;
}> | null = null;
let pendingFormPreferenceScope: string | null = null;
let formPreferenceUpdateTimer: number | null = null;

function pomodoroFormStorageKey(): string {
    return `${POMODORO_FORM_STORAGE_PREFIX}.${getAuthCacheScope()}`;
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isPomodoroFormValues(value: unknown): value is PomodoroFormValues {
    if (!value || typeof value !== 'object') return false;

    const form = value as Partial<PomodoroFormValues>;
    return isPositiveInteger(form.focusDuration)
        && isPositiveInteger(form.shortBreakDuration)
        && isPositiveInteger(form.longBreakDuration)
        && isPositiveInteger(form.numFocuses)
        && isPositiveInteger(form.longBreakCooldown);
}

export function readPomodoroFormPreferences(): PomodoroFormValues | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = window.localStorage.getItem(pomodoroFormStorageKey());
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        const runtime = getRuntimeUserPreferences();
        if (isPomodoroFormValues(parsed)) {
            return {
                ...parsed,
                focusDuration: runtime.pomodoroFocusDuration ?? parsed.focusDuration,
                shortBreakDuration: runtime.pomodoroShortBreakDuration ?? parsed.shortBreakDuration,
                longBreakDuration: runtime.pomodoroLongBreakDuration ?? parsed.longBreakDuration,
                numFocuses: runtime.pomodoroNumFocuses ?? parsed.numFocuses,
                longBreakCooldown: runtime.pomodoroLongBreakCooldown,
            };
        }

        if (runtime.pomodoroFocusDuration !== null
            && runtime.pomodoroShortBreakDuration !== null
            && runtime.pomodoroLongBreakDuration !== null
            && runtime.pomodoroNumFocuses !== null) {
            return {
                focusDuration: runtime.pomodoroFocusDuration,
                shortBreakDuration: runtime.pomodoroShortBreakDuration,
                longBreakDuration: runtime.pomodoroLongBreakDuration,
                numFocuses: runtime.pomodoroNumFocuses,
                longBreakCooldown: runtime.pomodoroLongBreakCooldown,
            };
        }
        return null;
    } catch (error) {
        console.warn('Could not read Pomodoro input preferences:', error);
        return null;
    }
}

export function savePomodoroFormPreferences(form: PomodoroFormValues): void {
    if (typeof window === 'undefined' || !isPomodoroFormValues(form)) return;

    try {
        window.localStorage.setItem(pomodoroFormStorageKey(), JSON.stringify(form));
        updateRuntimeUserPreferences({
            pomodoroLongBreakCooldown: form.longBreakCooldown,
            pomodoroFocusDuration: form.focusDuration,
            pomodoroShortBreakDuration: form.shortBreakDuration,
            pomodoroLongBreakDuration: form.longBreakDuration,
            pomodoroNumFocuses: form.numFocuses,
        });
        pendingFormPreferenceUpdate = {
            pomodoroFocusDuration: form.focusDuration,
            pomodoroShortBreakDuration: form.shortBreakDuration,
            pomodoroLongBreakDuration: form.longBreakDuration,
            pomodoroNumFocuses: form.numFocuses,
            pomodoroLongBreakCooldown: form.longBreakCooldown,
        };
        pendingFormPreferenceScope = getAuthCacheScope();
        if (formPreferenceUpdateTimer !== null) window.clearTimeout(formPreferenceUpdateTimer);
        formPreferenceUpdateTimer = window.setTimeout(() => {
            const updates = pendingFormPreferenceUpdate;
            const scope = pendingFormPreferenceScope;
            pendingFormPreferenceUpdate = null;
            pendingFormPreferenceScope = null;
            formPreferenceUpdateTimer = null;
            if (!updates || !scope || scope === 'anonymous' || getAuthCacheScope() !== scope) return;
            void userService.updatePreferences(updates).catch(error => {
                console.error('Could not save Pomodoro input preferences:', error);
            });
        }, 500);
        window.dispatchEvent(new Event(POMODORO_FORM_UPDATED_EVENT));
    } catch (error) {
        console.warn('Could not save Pomodoro input preferences:', error);
    }
}

export function subscribeToPomodoroFormPreferences(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined;

    const handleUpdate = () => listener();
    window.addEventListener(POMODORO_FORM_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
        window.removeEventListener(POMODORO_FORM_UPDATED_EVENT, handleUpdate);
        window.removeEventListener('storage', handleUpdate);
    };
}

export function createPomodoroFormDefaults(config: PomodoroConfig): PomodoroFormValues {
    return {
        focusDuration: config.defaultFocusDuration,
        shortBreakDuration: config.defaultShortBreakDuration,
        longBreakDuration: config.defaultLongBreakDuration,
        numFocuses: DEFAULT_NUM_FOCUSES,
        longBreakCooldown: DEFAULT_LONG_BREAK_COOLDOWN,
    };
}

export function isPomodoroFormDefaults(form: PomodoroFormValues, config: PomodoroConfig): boolean {
    return JSON.stringify(form) === JSON.stringify(createPomodoroFormDefaults(config));
}

export function setPomodoroSecondsModePreference(enabled: boolean): void {
    updateRuntimeUserPreferences({ pomodoroSecondsMode: enabled });
}

export function clearPomodoroConfigCache(): void {
    pomodoroConfigCache.clear();
    pomodoroConfigRequests.clear();
}

function getLocalSecondsModePreference(): boolean | null {
    return getRuntimeUserPreference('pomodoroSecondsMode');
}

function applyLocalPreference(config: PomodoroConfig): PomodoroConfig {
    const localPreference = getLocalSecondsModePreference();
    if (localPreference === null) return config;
    return localPreference ? DEV_POMODORO_CONFIG : NORMAL_POMODORO_CONFIG;
}

export async function getPomodoroConfig(): Promise<PomodoroConfig> {
    const cacheKey = getAuthCacheScope();
    const cachedConfig = pomodoroConfigCache.get(cacheKey);
    if (cachedConfig) return applyLocalPreference(cachedConfig);

    let request = pomodoroConfigRequests.get(cacheKey);
    if (!request) {
        request = fetch(`${API_BASE_URL}/api/v1/pomodoro/config`, {
            headers: getAuthHeaders(),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load Pomodoro configuration (${response.status})`);
                }
                return response.json() as Promise<PomodoroConfig>;
            })
            .then(config => {
                pomodoroConfigCache.set(cacheKey, config);
                return config;
            });
        pomodoroConfigRequests.set(cacheKey, request);
    }

    try {
        return applyLocalPreference(await request);
    } finally {
        if (pomodoroConfigRequests.get(cacheKey) === request) {
            pomodoroConfigRequests.delete(cacheKey);
        }
    }
}
