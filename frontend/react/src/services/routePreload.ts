import { TASK_PAGE_BATCH_SIZE, taskService } from './api/taskService';
import { getShowCompletedHomeTasks } from './utils/homePreferences';

let homePageRequest: Promise<typeof import('../pages/HomePage')> | null = null;
let taskPageRequest: Promise<typeof import('../pages/TaskPage')> | null = null;
let taskPageDataRequest: Promise<unknown> | null = null;

export function loadHomePageModule(): Promise<typeof import('../pages/HomePage')> {
    homePageRequest ??= import('../pages/HomePage');
    return homePageRequest;
}

export function loadTaskPageModule(): Promise<typeof import('../pages/TaskPage')> {
    taskPageRequest ??= import('../pages/TaskPage');
    return taskPageRequest;
}

function preloadTaskPageData(): void {
    const completedFilter = getShowCompletedHomeTasks() ? undefined : false;
    taskPageDataRequest ??= taskService
        .getTaskPageInitialSnapshot(TASK_PAGE_BATCH_SIZE, completedFilter)
        .catch(error => {
            console.error('Failed to preload the Tasks page:', error);
        })
        .finally(() => {
            taskPageDataRequest = null;
        });
}

export function preloadPrimaryRoute(path: string): void {
    if (path === '/') void loadHomePageModule();
    if (path === '/tasks') {
        void loadTaskPageModule();
        preloadTaskPageData();
    }
}

export function preloadInactivePrimaryRoutes(currentPath: string): void {
    if (currentPath !== '/') void loadHomePageModule();
    if (currentPath !== '/tasks') {
        void loadTaskPageModule();
        preloadTaskPageData();
    }
}
