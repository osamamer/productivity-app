export const SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY = 'showCompletedHomeTasks';
export const EXCLUDE_TODAY_COMPLETED_HOME_TASKS_STORAGE_KEY = 'excludeTodayCompletedHomeTasks';
import { getRuntimeUserPreference, updateRuntimeUserPreferences } from '../userPreferenceStore';

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
