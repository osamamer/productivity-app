export const SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY = 'showCompletedHomeTasks';
export const EXCLUDE_TODAY_COMPLETED_HOME_TASKS_STORAGE_KEY = 'excludeTodayCompletedHomeTasks';

export function getShowCompletedHomeTasks(): boolean {
    return window.localStorage.getItem(SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY) !== 'false';
}

export function getExcludeTodayCompletedHomeTasks(): boolean {
    return window.localStorage.getItem(EXCLUDE_TODAY_COMPLETED_HOME_TASKS_STORAGE_KEY) === 'true';
}
