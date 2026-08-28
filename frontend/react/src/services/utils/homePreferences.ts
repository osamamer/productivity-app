export const SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY = 'showCompletedHomeTasks';

export function getShowCompletedHomeTasks(): boolean {
    return window.localStorage.getItem(SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY) !== 'false';
}
