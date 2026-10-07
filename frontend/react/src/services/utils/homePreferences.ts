import { getRuntimeUserPreference, updateRuntimeUserPreferences } from '../userPreferenceStore';

export const SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY = 'showCompletedHomeTasks';
export const EXCLUDE_TODAY_COMPLETED_HOME_TASKS_STORAGE_KEY = 'excludeTodayCompletedHomeTasks';
export const HOME_TODAY_EVENTS_EXPANDED_STORAGE_KEY = 'homeTodayEventsExpanded';

export function getShowCompletedHomeTasks(): boolean {
    return getRuntimeUserPreference('showCompletedHomeTasks');
}

export function getExcludeTodayCompletedHomeTasks(): boolean {
    return getRuntimeUserPreference('excludeTodayCompletedTasks');
}

export function setShowCompletedHomeTasks(value: boolean): void {
    updateRuntimeUserPreferences({ showCompletedHomeTasks: value });
}

export function setExcludeTodayCompletedTasks(value: boolean): void {
    updateRuntimeUserPreferences({ excludeTodayCompletedTasks: value });
}

export function getHomeTodayEventsExpanded(): boolean {
    try {
        const storedValue = window.localStorage.getItem(HOME_TODAY_EVENTS_EXPANDED_STORAGE_KEY);
        if (storedValue === 'true') return true;
        if (storedValue === 'false') return false;
        return true;
    } catch (error) {
        console.warn('Unable to read Home event expansion from local storage.', error);
        return true;
    }
}

export function setHomeTodayEventsExpanded(value: boolean): void {
    try {
        window.localStorage.setItem(HOME_TODAY_EVENTS_EXPANDED_STORAGE_KEY, String(value));
    } catch (error) {
        console.warn('Unable to save Home event expansion to local storage.', error);
    }
}
