import type { UserPreferences } from './api/userService';

export type RuntimeUserPreferences = {
    showCompletedHomeTasks: boolean;
    excludeTodayCompletedTasks: boolean;
    showClosedMentalThreads: boolean;
    soundEffectsEnabled: boolean;
    whiteNoiseEnabled: boolean;
    pomodoroSecondsMode: boolean | null;
    pomodoroLongBreakCooldown: number;
    pomodoroFocusDuration: number | null;
    pomodoroShortBreakDuration: number | null;
    pomodoroLongBreakDuration: number | null;
    pomodoroNumFocuses: number | null;
    themeMode: 'light' | 'dark' | null;
    accentColor: string;
    meditationDurationMinutes: number;
    meditationIntervalBells: number;
    meditationSound: 'rain' | 'ocean' | 'forest' | 'bowls';
};

const DEFAULT_RUNTIME_PREFERENCES: RuntimeUserPreferences = {
    showCompletedHomeTasks: true,
    excludeTodayCompletedTasks: false,
    showClosedMentalThreads: false,
    soundEffectsEnabled: true,
    whiteNoiseEnabled: true,
    pomodoroSecondsMode: null,
    pomodoroLongBreakCooldown: 4,
    pomodoroFocusDuration: null,
    pomodoroShortBreakDuration: null,
    pomodoroLongBreakDuration: null,
    pomodoroNumFocuses: null,
    themeMode: null,
    accentColor: 'violet',
    meditationDurationMinutes: 10,
    meditationIntervalBells: 2,
    meditationSound: 'rain',
};

let activeScope = 'anonymous';
let runtimePreferences: RuntimeUserPreferences = { ...DEFAULT_RUNTIME_PREFERENCES };
const listeners = new Set<() => void>();

export function getRuntimeUserPreferences(): RuntimeUserPreferences {
    return runtimePreferences;
}

export function getRuntimeUserPreference<K extends keyof RuntimeUserPreferences>(
    key: K,
): RuntimeUserPreferences[K] {
    return runtimePreferences[key];
}

export function subscribeToUserPreferences(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function applyUserPreferences(scope: string, preferences: UserPreferences): void {
    if (scope !== activeScope) {
        activeScope = scope;
        runtimePreferences = { ...DEFAULT_RUNTIME_PREFERENCES };
    }

    runtimePreferences = {
        ...runtimePreferences,
        showCompletedHomeTasks: preferences.showCompletedHomeTasks ?? DEFAULT_RUNTIME_PREFERENCES.showCompletedHomeTasks,
        excludeTodayCompletedTasks: preferences.excludeTodayCompletedTasks ?? DEFAULT_RUNTIME_PREFERENCES.excludeTodayCompletedTasks,
        showClosedMentalThreads: preferences.showClosedMentalThreads ?? DEFAULT_RUNTIME_PREFERENCES.showClosedMentalThreads,
        soundEffectsEnabled: preferences.soundEffectsEnabled ?? DEFAULT_RUNTIME_PREFERENCES.soundEffectsEnabled,
        whiteNoiseEnabled: preferences.whiteNoiseEnabled ?? DEFAULT_RUNTIME_PREFERENCES.whiteNoiseEnabled,
        pomodoroSecondsMode: preferences.pomodoroSecondsMode ?? DEFAULT_RUNTIME_PREFERENCES.pomodoroSecondsMode,
        pomodoroLongBreakCooldown: preferences.pomodoroLongBreakCooldown ?? DEFAULT_RUNTIME_PREFERENCES.pomodoroLongBreakCooldown,
        pomodoroFocusDuration: preferences.pomodoroFocusDuration ?? DEFAULT_RUNTIME_PREFERENCES.pomodoroFocusDuration,
        pomodoroShortBreakDuration: preferences.pomodoroShortBreakDuration ?? DEFAULT_RUNTIME_PREFERENCES.pomodoroShortBreakDuration,
        pomodoroLongBreakDuration: preferences.pomodoroLongBreakDuration ?? DEFAULT_RUNTIME_PREFERENCES.pomodoroLongBreakDuration,
        pomodoroNumFocuses: preferences.pomodoroNumFocuses ?? DEFAULT_RUNTIME_PREFERENCES.pomodoroNumFocuses,
        themeMode: preferences.themeMode ?? DEFAULT_RUNTIME_PREFERENCES.themeMode,
        accentColor: preferences.accentColor ?? DEFAULT_RUNTIME_PREFERENCES.accentColor,
        meditationDurationMinutes: preferences.meditationDurationMinutes ?? DEFAULT_RUNTIME_PREFERENCES.meditationDurationMinutes,
        meditationIntervalBells: preferences.meditationIntervalBells ?? DEFAULT_RUNTIME_PREFERENCES.meditationIntervalBells,
        meditationSound: preferences.meditationSound ?? DEFAULT_RUNTIME_PREFERENCES.meditationSound,
    };
    listeners.forEach(listener => listener());
}

export function updateRuntimeUserPreferences(updates: Partial<RuntimeUserPreferences>): void {
    runtimePreferences = { ...runtimePreferences, ...updates };
    listeners.forEach(listener => listener());
}

function storedBoolean(key: string): boolean | null {
    const value = window.localStorage.getItem(key);
    if (value === null) return null;
    return value === 'true';
}

/** Reads the pre-account settings once so an existing device does not lose its choices during migration. */
export function readLegacyUserPreferenceUpdates(): Partial<UserPreferences> {
    if (typeof window === 'undefined') return {};

    try {
        const updates: Partial<UserPreferences> = {};
        const showCompleted = storedBoolean('showCompletedHomeTasks');
        const excludeToday = storedBoolean('excludeTodayCompletedHomeTasks');
        const showClosedThreads = storedBoolean('showClosedMentalThreads');
        const soundEffects = storedBoolean('claritard.audio-feedback-enabled');
        const whiteNoise = storedBoolean('pomodoro-white-noise-enabled');
        const secondsMode = storedBoolean('pomodoroDevSecondsMode');

        if (showCompleted !== null) updates.showCompletedHomeTasks = showCompleted;
        if (excludeToday !== null) updates.excludeTodayCompletedTasks = excludeToday;
        if (showClosedThreads !== null) updates.showClosedMentalThreads = showClosedThreads;
        if (soundEffects !== null) updates.soundEffectsEnabled = soundEffects;
        if (whiteNoise !== null) updates.whiteNoiseEnabled = whiteNoise;
        if (secondsMode !== null) updates.pomodoroSecondsMode = secondsMode;

        const themeMode = window.localStorage.getItem('themeMode');
        if (themeMode === 'light' || themeMode === 'dark') {
            updates.themeMode = themeMode;
        } else {
            const darkMode = window.localStorage.getItem('darkMode');
            if (darkMode === 'true') updates.themeMode = 'dark';
            if (darkMode === 'false') updates.themeMode = 'light';
        }

        const accentColor = window.localStorage.getItem('accentColor');
        if (accentColor === 'teal' || accentColor === 'coral' || accentColor === 'amber' || accentColor === 'violet') {
            updates.accentColor = accentColor;
        }

        const form = window.localStorage.getItem(`solife.pomodoro-form.${activeScope}`);
        if (form) {
            const parsed = JSON.parse(form) as {
                longBreakCooldown?: unknown;
                focusDuration?: unknown;
                shortBreakDuration?: unknown;
                longBreakDuration?: unknown;
                numFocuses?: unknown;
            };
            if (typeof parsed.longBreakCooldown === 'number'
                && Number.isInteger(parsed.longBreakCooldown)
                && parsed.longBreakCooldown >= 1
                && parsed.longBreakCooldown <= 5) {
                updates.pomodoroLongBreakCooldown = parsed.longBreakCooldown;
            }
            if (typeof parsed.focusDuration === 'number' && Number.isInteger(parsed.focusDuration) && parsed.focusDuration > 0) {
                updates.pomodoroFocusDuration = parsed.focusDuration;
            }
            if (typeof parsed.shortBreakDuration === 'number' && Number.isInteger(parsed.shortBreakDuration) && parsed.shortBreakDuration > 0) {
                updates.pomodoroShortBreakDuration = parsed.shortBreakDuration;
            }
            if (typeof parsed.longBreakDuration === 'number' && Number.isInteger(parsed.longBreakDuration) && parsed.longBreakDuration > 0) {
                updates.pomodoroLongBreakDuration = parsed.longBreakDuration;
            }
            if (typeof parsed.numFocuses === 'number' && Number.isInteger(parsed.numFocuses) && parsed.numFocuses > 0) {
                updates.pomodoroNumFocuses = parsed.numFocuses;
            }
        }

        const meditation = window.localStorage.getItem(`meditation-settings:${activeScope}`);
        if (meditation) {
            const parsed = JSON.parse(meditation) as {
                durationMinutes?: unknown;
                numIntervalBells?: unknown;
                selectedSound?: unknown;
            };
            if (typeof parsed.durationMinutes === 'number') updates.meditationDurationMinutes = parsed.durationMinutes;
            if (typeof parsed.numIntervalBells === 'number') updates.meditationIntervalBells = parsed.numIntervalBells;
            if (parsed.selectedSound === 'rain' || parsed.selectedSound === 'ocean'
                || parsed.selectedSound === 'forest' || parsed.selectedSound === 'bowls') {
                updates.meditationSound = parsed.selectedSound;
            }
        }

        if (!updates.meditationSound) {
            const legacySound = window.localStorage.getItem('meditation-soundscape');
            if (legacySound === 'rain' || legacySound === 'ocean'
                || legacySound === 'forest' || legacySound === 'bowls') {
                updates.meditationSound = legacySound;
            }
        }

        return updates;
    } catch (error) {
        console.warn('Could not read legacy user preferences:', error);
        return {};
    }
}

export function clearLegacyUserPreferences(): void {
    if (typeof window === 'undefined') return;
    [
        'showCompletedHomeTasks',
        'excludeTodayCompletedHomeTasks',
        'showClosedMentalThreads',
        'claritard.audio-feedback-enabled',
        'pomodoro-white-noise-enabled',
        'pomodoroDevSecondsMode',
        'themeMode',
        'darkMode',
        'accentColor',
        'meditation-soundscape',
    ].forEach(key => window.localStorage.removeItem(key));
}
