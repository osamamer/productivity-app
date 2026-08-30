import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { TtlCache } from '../cache/ttlCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type PomodoroDurationUnit = 'minutes' | 'seconds';
export const POMODORO_DEV_SECONDS_MODE_STORAGE_KEY = 'pomodoroDevSecondsMode';

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
const DEFAULT_LONG_BREAK_COOLDOWN = 4;

const POMODORO_CONFIG_TTL_MS = 5 * 60 * 1000;
const pomodoroConfigCache = new TtlCache<PomodoroConfig>({ ttlMs: POMODORO_CONFIG_TTL_MS, maxEntries: 4 });
const pomodoroConfigRequests = new Map<string, Promise<PomodoroConfig>>();

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
    localStorage.setItem(POMODORO_DEV_SECONDS_MODE_STORAGE_KEY, String(enabled));
}

export function clearPomodoroConfigCache(): void {
    pomodoroConfigCache.clear();
    pomodoroConfigRequests.clear();
}

function getLocalSecondsModePreference(): boolean | null {
    const storedValue = localStorage.getItem(POMODORO_DEV_SECONDS_MODE_STORAGE_KEY);
    if (storedValue === 'true') return true;
    if (storedValue === 'false') return false;
    return null;
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
