
import { PRIORITY_OPTIONS } from './monthCalendarItems';

export type TaskStatusFilter = 'all' | 'open' | 'completed';

export const CALENDAR_DISPLAY_PREFERENCES_KEY = 'calendar-display-preferences';
export type CalendarDisplayView = 'month' | 'week';

export type CalendarDisplaySettings = {
    showTasks: boolean;
    showStatTasks: boolean;
    showDailyRecurringTasks: boolean;
    showStats: boolean;
    showChunks: boolean;
    taskStatus: TaskStatusFilter;
    priorityFilters: number[];
    selectedStatIds: string[] | null;
};

export type CalendarDisplayPreferences = Record<CalendarDisplayView, CalendarDisplaySettings>;

export const DEFAULT_CALENDAR_DISPLAY_SETTINGS: CalendarDisplaySettings = {
    showTasks: true,
    showStatTasks: true,
    showDailyRecurringTasks: true,
    showStats: true,
    showChunks: true,
    taskStatus: 'open',
    priorityFilters: [3, 6, 9],
    selectedStatIds: null,
};

export function defaultCalendarDisplayPreferences(): CalendarDisplayPreferences {
    return {
        month: {
            ...DEFAULT_CALENDAR_DISPLAY_SETTINGS,
            priorityFilters: [...DEFAULT_CALENDAR_DISPLAY_SETTINGS.priorityFilters],
        },
        week: {
            ...DEFAULT_CALENDAR_DISPLAY_SETTINGS,
            priorityFilters: [...DEFAULT_CALENDAR_DISPLAY_SETTINGS.priorityFilters],
        },
    };
}

export function normalizeCalendarDisplaySettings(value: unknown): CalendarDisplaySettings {
    const parsed = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Partial<CalendarDisplaySettings>
        : {};

    return {
        showTasks: typeof parsed.showTasks === 'boolean'
            ? parsed.showTasks
            : DEFAULT_CALENDAR_DISPLAY_SETTINGS.showTasks,
        showStatTasks: typeof parsed.showStatTasks === 'boolean'
            ? parsed.showStatTasks
            : DEFAULT_CALENDAR_DISPLAY_SETTINGS.showStatTasks,
        showDailyRecurringTasks: typeof parsed.showDailyRecurringTasks === 'boolean'
            ? parsed.showDailyRecurringTasks
            : DEFAULT_CALENDAR_DISPLAY_SETTINGS.showDailyRecurringTasks,
        showStats: typeof parsed.showStats === 'boolean'
            ? parsed.showStats
            : DEFAULT_CALENDAR_DISPLAY_SETTINGS.showStats,
        showChunks: typeof parsed.showChunks === 'boolean'
            ? parsed.showChunks
            : DEFAULT_CALENDAR_DISPLAY_SETTINGS.showChunks,
        taskStatus: parsed.taskStatus === 'open' || parsed.taskStatus === 'completed'
            ? parsed.taskStatus
            : DEFAULT_CALENDAR_DISPLAY_SETTINGS.taskStatus,
        priorityFilters: Array.isArray(parsed.priorityFilters)
            ? parsed.priorityFilters.filter(value => PRIORITY_OPTIONS.some(option => option.value === value))
            : [...DEFAULT_CALENDAR_DISPLAY_SETTINGS.priorityFilters],
        selectedStatIds: Array.isArray(parsed.selectedStatIds)
            ? parsed.selectedStatIds.filter((id): id is string => typeof id === 'string')
            : DEFAULT_CALENDAR_DISPLAY_SETTINGS.selectedStatIds,
    };
}

export function readCalendarDisplayPreferences(): CalendarDisplayPreferences {
    const defaults = defaultCalendarDisplayPreferences();
    if (typeof window === 'undefined') return defaults;

    try {
        const stored = window.localStorage.getItem(CALENDAR_DISPLAY_PREFERENCES_KEY);
        if (!stored) return defaults;

        const parsed = JSON.parse(stored) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;

        const storedPreferences = parsed as Partial<Record<CalendarDisplayView, unknown>> & Partial<CalendarDisplaySettings>;
        const hasPerViewPreferences = storedPreferences.month !== undefined || storedPreferences.week !== undefined;
        if (!hasPerViewPreferences) {
            // Keep existing month settings when upgrading from the original flat preference shape.
            return {
                month: normalizeCalendarDisplaySettings(parsed),
                week: defaults.week,
            };
        }

        return {
            month: normalizeCalendarDisplaySettings(storedPreferences.month),
            week: normalizeCalendarDisplaySettings(storedPreferences.week),
        };
    } catch {
        return defaults;
    }
}

export function writeCalendarDisplayPreferences(preferences: CalendarDisplayPreferences): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(CALENDAR_DISPLAY_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
        // Preferences are optional; private browsing may make storage unavailable.
    }
}
