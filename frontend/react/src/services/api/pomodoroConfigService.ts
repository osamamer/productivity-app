import { getAuthHeaders } from '../utils/authHeaders';

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

let serverConfigRequest: Promise<PomodoroConfig> | null = null;

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
    if (!serverConfigRequest) {
        serverConfigRequest = fetch(`${API_BASE_URL}/api/v1/pomodoro/config`, {
            headers: getAuthHeaders(),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load Pomodoro configuration (${response.status})`);
                }
                return response.json() as Promise<PomodoroConfig>;
            })
            .catch(error => {
                serverConfigRequest = null;
                throw error;
            });
    }

    return applyLocalPreference(await serverConfigRequest);
}
