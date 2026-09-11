import { Task } from '../../types/Task';
import { TaskToCreate } from '../../types/TaskToCreate';
import { getAuthHeaders } from '../utils/authHeaders';
import { PomodoroStatus } from '../../types/PomodoroStatus';
import { TaskPomodoroStats, TodayFocusSummary } from '../../types/TaskPomodoroStats';
import { invalidateTaskPomodoroStats } from '../cache/taskPomodoroStatsCache';
import { CachedResource } from '../cache/ttlCache';
import { getAuthCacheScope } from '../utils/authHeaders';
import { clearTaskSubtasksCache, invalidateTaskSubtasks, loadTaskSubtasks } from '../cache/taskSubtasksCache';
import { TaskSeries } from '../../types/TaskSeries';
import { TaskRecurrenceDraft } from '../../types/TaskRecurrence';
import { invalidateResource, subscribeToResourceInvalidation } from '../cache/resourceInvalidation';
import {
    clearTaskSeriesCache,
    loadTaskSeries,
    setCachedTaskSeries,
} from '../cache/taskSeriesCache';
import {
    clearTaskDetailsCache,
    getCachedTaskDetails,
    invalidateTaskDetails,
    loadTaskDetails,
    setCachedTaskDetails,
} from '../cache/taskDetailsCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const TASK_URL = `${API_BASE_URL}/api/v1/tasks`;
const TASK_SERIES_URL = `${API_BASE_URL}/api/v1/task-series`;
const SESSION_URL = `${API_BASE_URL}/api/v1/session`;
const POMODORO_URL = `${API_BASE_URL}/api/v1/pomodoro`;
// Task data changes through this service and is explicitly invalidated after
// mutations, so it can stay warm for the lifetime of a normal work session.
const TASK_CACHE_TTL_MS = 60 * 60 * 1000;
const TASK_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const TASK_PAGE_BATCH_SIZE = 30;

export type TaskPageInitialSnapshot = {
    tasks: Task[];
    hasMoreFutureTasks: boolean;
    hasMorePastTasks: boolean;
};

type DeleteTaskOptions = {
    notifyResource?: boolean;
};
const mainTasksCache = new CachedResource<Task[]>({ ttlMs: TASK_CACHE_TTL_MS, maxEntries: 4 });
const todayTasksCache = new CachedResource<Task[]>({ ttlMs: TASK_CACHE_TTL_MS, maxEntries: 4 });
const taskPageInitialCache = new CachedResource<TaskPageInitialSnapshot>({ ttlMs: TASK_CACHE_TTL_MS, maxEntries: 4 });
const taskPageBatchCache = new CachedResource<Task[]>({ ttlMs: TASK_CACHE_TTL_MS, maxEntries: 12 });

function mainTasksCacheKey(): string {
    return `${getAuthCacheScope()}:main-tasks`;
}

function mainTasksStorageKey(): string {
    return `claritard:${mainTasksCacheKey()}`;
}

function readPersistedMainTasks(): Task[] | undefined {
    if (typeof window === 'undefined') return undefined;

    try {
        const raw = window.sessionStorage.getItem(mainTasksStorageKey());
        if (!raw) return undefined;

        const snapshot = JSON.parse(raw) as { savedAt?: number; tasks?: Task[] };
        const savedAt = snapshot.savedAt;
        if (!Array.isArray(snapshot.tasks) || typeof savedAt !== 'number' || !Number.isFinite(savedAt)) {
            return undefined;
        }
        if (Date.now() - savedAt > TASK_SNAPSHOT_MAX_AGE_MS) {
            window.sessionStorage.removeItem(mainTasksStorageKey());
            return undefined;
        }
        return snapshot.tasks;
    } catch (error) {
        console.warn('Could not read the cached task snapshot:', error);
        return undefined;
    }
}

function persistMainTasks(tasks: Task[]): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(mainTasksStorageKey(), JSON.stringify({
            savedAt: Date.now(),
            tasks,
        }));
    } catch (error) {
        console.warn('Could not persist the cached task snapshot:', error);
    }
}

function todayTasksCacheKey(): string {
    return `${getAuthCacheScope()}:today-tasks`;
}

function invalidateTodayTasksCache(): void {
    todayTasksCache.invalidate(todayTasksCacheKey());
}

function invalidateMainTasksCache(): void {
    mainTasksCache.invalidate(mainTasksCacheKey());
}

function invalidateTaskViewCaches(): void {
    invalidateTodayTasksCache();
    invalidateTaskPageCache();
}

function invalidateTaskListCaches(): void {
    invalidateMainTasksCache();
    invalidateTaskViewCaches();
}

function invalidateTaskPageCache(): void {
    taskPageInitialCache.clear();
    taskPageBatchCache.clear();
}

function invalidatePomodoroData(taskId: string): void {
    invalidateTaskPomodoroStats(taskId);
    invalidateResource('tasks');
}

function clearTaskDataCaches(): void {
    mainTasksCache.clear();
    if (typeof window !== 'undefined') {
        try {
            window.sessionStorage.removeItem(mainTasksStorageKey());
        } catch (error) {
            console.warn('Could not clear the cached task snapshot:', error);
        }
    }
    todayTasksCache.clear();
    invalidateTaskPageCache();
    clearTaskSubtasksCache();
    clearTaskSeriesCache();
    clearTaskDetailsCache();
}

function getMainTasksSnapshotForMutation(): Task[] | undefined {
    return mainTasksCache.getStale(mainTasksCacheKey()) ?? readPersistedMainTasks();
}

function setMainTasksSnapshot(tasks: Task[]): void {
    mainTasksCache.set(mainTasksCacheKey(), tasks, TASK_CACHE_TTL_MS);
    persistMainTasks(tasks);
}

function cacheMainTasks(tasks: Task[]): void {
    const currentTasks = getMainTasksSnapshotForMutation();
    if (!currentTasks) return;

    const nextTasks = [...currentTasks];
    tasks.filter(task => !task.parentId).forEach(task => {
        const existingIndex = nextTasks.findIndex(candidate => candidate.taskId === task.taskId);
        if (existingIndex === -1) {
            nextTasks.unshift(task);
        } else {
            nextTasks[existingIndex] = task;
        }
    });
    setMainTasksSnapshot(nextTasks);
}

subscribeToResourceInvalidation('stats', clearTaskDataCaches);

function taskPageBatchCacheKey(
    period: 'PAST' | 'FUTURE',
    limit: number,
    offset: number,
    completed?: boolean,
): string {
    const completionFilter = completed === undefined ? 'all' : String(completed);
    return `${getAuthCacheScope()}:task-page:${period}:${completionFilter}:${limit}:${offset}`;
}

async function fetchTaskPeriod(
    period: 'PAST' | 'FUTURE',
    limit?: number,
    offset = 0,
    completed?: boolean,
): Promise<Task[]> {
    const params = new URLSearchParams({ period });
    if (completed !== undefined) {
        params.set('completed', String(completed));
    }
    if (limit !== undefined) {
        params.set('limit', String(limit));
        params.set('offset', String(offset));
    }

    const load = async () => {
        const response = await fetch(`${TASK_URL}?${params.toString()}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${period.toLowerCase()} tasks`);
        }
        return response.json() as Promise<Task[]>;
    };

    return limit === undefined
        ? load()
        : taskPageBatchCache.get(taskPageBatchCacheKey(period, limit, offset, completed), load);
}

async function fetchUndatedTasks(completed?: boolean): Promise<Task[]> {
    const params = new URLSearchParams({ scheduled: 'false' });
    if (completed !== undefined) params.set('completed', String(completed));

    const response = await fetch(`${TASK_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch undated tasks');
    return response.json() as Promise<Task[]>;
}

export const taskService = {

    // ============ Task Queries ============

    async getAllMainTasks(forceRefresh = false): Promise<Task[]> {
        const key = mainTasksCacheKey();
        if (forceRefresh) mainTasksCache.invalidate(key);

        return mainTasksCache.get(key, async () => {
            const response = await fetch(`${TASK_URL}/main`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error('Failed to fetch all tasks');
            }
            const tasks = await response.json() as Task[];
            persistMainTasks(tasks);
            return tasks;
        });
    },

    getCachedMainTasks(): Task[] | undefined {
        return mainTasksCache.getStale(mainTasksCacheKey()) ?? readPersistedMainTasks();
    },

    getCachedTodayTasks(): Task[] | undefined {
        return todayTasksCache.getStale(todayTasksCacheKey());
    },

    cacheMainTasks(tasks: Task[]): void {
        cacheMainTasks(tasks);
        invalidateTaskViewCaches();
    },

    async getTodayTasks(forceRefresh = false): Promise<Task[]> {
        const key = todayTasksCacheKey();
        if (forceRefresh) todayTasksCache.invalidate(key);

        return todayTasksCache.get(key, async () => {
            const response = await fetch(`${TASK_URL}/today`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error('Failed to fetch today tasks');
            }
            return response.json() as Promise<Task[]>;
        });
    },

    async getTaskPageInitialSnapshot(
        batchSize = TASK_PAGE_BATCH_SIZE,
        completed?: boolean,
        forceRefresh = false,
    ): Promise<TaskPageInitialSnapshot> {
        const completionFilter = completed === undefined ? 'all' : String(completed);
        const cacheKey = `${getAuthCacheScope()}:task-page-initial:${completionFilter}:${batchSize}`;
        if (forceRefresh) {
            taskPageInitialCache.invalidate(cacheKey);
            invalidateTodayTasksCache();
            taskPageBatchCache.clear();
        }

        return taskPageInitialCache.get(cacheKey, async () => {
            const [today, future, past, undated] = await Promise.all([
                this.getTodayTasks(),
                fetchTaskPeriod('FUTURE', batchSize + 1, 0, completed),
                fetchTaskPeriod('PAST', batchSize + 1, 0, completed),
                fetchUndatedTasks(completed),
            ]);
            return {
                tasks: [
                    ...today,
                    ...future.slice(0, batchSize),
                    ...past.slice(0, batchSize),
                    ...undated,
                ],
                hasMoreFutureTasks: future.length > batchSize,
                hasMorePastTasks: past.length > batchSize,
            };
        });
    },

    async reorderTasks(taskIds: string[]): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}/order`, {
            method: 'PUT',
            body: JSON.stringify({ taskIds }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) {
            throw new Error('Failed to reorder tasks');
        }
        const tasks = await response.json() as Task[];
        setMainTasksSnapshot(tasks);
        invalidateTaskViewCaches();
        return tasks;
    },

    async getPastTasks(limit?: number, offset = 0, completed?: boolean): Promise<Task[]> {
        return fetchTaskPeriod('PAST', limit, offset, completed);
    },

    async getFutureTasks(limit?: number, offset = 0, completed?: boolean): Promise<Task[]> {
        return fetchTaskPeriod('FUTURE', limit, offset, completed);
    },

    async getHighestPriorityTask(): Promise<Task> {
        const response = await fetch(`${TASK_URL}/highest-priority`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch highest priority task');
        }
        return response.json();
    },

    async getSubtasks(taskId: string): Promise<Task[]> {
        return loadTaskSubtasks(taskId, async () => {
            const response = await fetch(`${TASK_URL}/${taskId}/subtasks`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error('Failed to fetch subtasks');
            }
            return response.json() as Promise<Task[]>;
        });
    },

    async getTaskDetails(task: Task) {
        const cached = getCachedTaskDetails(task.taskId);
        if (cached) {
            // The related fields are still warm, but keep the core task in
            // sync with the list that currently owns the row.
            if (cached.task !== task) {
                const updated = { ...cached, task };
                setCachedTaskDetails(task.taskId, updated);
                return updated;
            }
            return cached;
        }

        const details = await loadTaskDetails(task.taskId, async () => {
            // The task list already tells us whether this task belongs to a
            // series. Avoid asking the task endpoint to rediscover that fact
            // for ordinary tasks, and use the series endpoint directly when
            // recurrence does exist.
            const subtasksPromise = this.getSubtasks(task.taskId);
            const taskSeriesPromise = task.taskSeriesId
                ? this.getTaskSeries(task.taskId, task.taskSeriesId)
                : Promise.resolve(null);
            const [subtasks, taskSeries] = await Promise.all([subtasksPromise, taskSeriesPromise]);
            return { task, subtasks, taskSeries };
        });

        if (details.task !== task) {
            const updated = { ...details, task };
            setCachedTaskDetails(task.taskId, updated);
            return updated;
        }
        return details;
    },

    async getPomodoroStats(taskId: string, signal?: AbortSignal): Promise<TaskPomodoroStats> {
        const response = await fetch(`${TASK_URL}/${taskId}/pomodoro-stats`, {
            headers: getAuthHeaders(),
            signal,
        });
        if (!response.ok) {
            throw new Error('Failed to fetch Pomodoro stats');
        }
        return response.json();
    },

    async getTodayFocusSummary(date: string): Promise<TodayFocusSummary> {
        const response = await fetch(`${TASK_URL}/focus-today?date=${encodeURIComponent(date)}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch today focus summary');
        }
        return response.json();
    },

    // ============ Task Mutations ============

    async createTask(task: TaskToCreate): Promise<Task> {
        const response = await fetch(`${TASK_URL}`, {
            method: 'POST',
            body: JSON.stringify({
                name: task.name,
                description: task.description,
                scheduledPerformDateTime: task.scheduledPerformDateTime,
                reminderMinutesBefore: task.reminderMinutesBefore,
                tag: task.tag,
                importance: task.importance,
                parentId: task.parentId,
                mentalThreadId: task.mentalThreadId,
                recurrenceFrequency: task.recurrenceFrequency,
                recurrenceEndDate: task.recurrenceEndDate,
                recurrenceInterval: task.recurrenceInterval,
                recurrenceUnit: task.recurrenceUnit,
                recurrenceDaysOfWeek: task.recurrenceDaysOfWeek,
                timeZone: task.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });

        if (!response.ok) {
            throw new Error('Failed to create task');
        }
        if (task.parentId) {
            invalidateTaskSubtasks(task.parentId);
            invalidateTaskDetails(task.parentId);
        }
        const createdTask = await response.json() as Task;
        if (task.recurrenceFrequency) {
            // A recurring create also materializes future occurrences, so one
            // response cannot represent the complete main-task snapshot.
            invalidateTaskListCaches();
        } else {
            cacheMainTasks([createdTask]);
            invalidateTaskViewCaches();
        }
        return createdTask;
    },

    async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
        const response = await fetch(`${TASK_URL}/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });

        if (!response.ok) {
            throw new Error('Failed to update task');
        }
        const updatedTask = await response.json() as Task;
        const cachedDetails = getCachedTaskDetails(taskId);
        if (cachedDetails) setCachedTaskDetails(taskId, { ...cachedDetails, task: updatedTask });
        invalidateTaskPomodoroStats(taskId);
        cacheMainTasks([updatedTask]);
        invalidateTaskViewCaches();
        if (updates.completed !== undefined) invalidateResource('tasks');
        return updatedTask;
    },

    async getTask(taskId: string): Promise<Task> {
        const response = await fetch(`${TASK_URL}/${taskId}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch task');
        }
        return response.json();
    },

    async getTaskSeries(taskId: string, seriesId?: string | null): Promise<TaskSeries | null> {
        return loadTaskSeries(taskId, async () => {
            const url = seriesId
                ? `${TASK_SERIES_URL}/${seriesId}`
                : `${TASK_URL}/${taskId}/recurrence`;
            const response = await fetch(url, {
                headers: getAuthHeaders(),
            });
            if (response.status === 404) return null;
            if (!response.ok) {
                throw new Error('Failed to fetch task recurrence');
            }
            return response.json() as Promise<TaskSeries>;
        });
    },

    async startTaskRecurrence(taskId: string, recurrence: TaskRecurrenceDraft): Promise<TaskSeries> {
        const response = await fetch(`${TASK_URL}/${taskId}/recurrence`, {
            method: 'POST',
            body: JSON.stringify(recurrence),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) {
            throw new Error('Failed to start task recurrence');
        }
        const series = await response.json() as TaskSeries;
        setCachedTaskSeries(taskId, series);
        const cachedDetails = getCachedTaskDetails(taskId);
        if (cachedDetails) setCachedTaskDetails(taskId, { ...cachedDetails, taskSeries: series });
        invalidateTaskListCaches();
        invalidateResource('tasks');
        return series;
    },

    async updateTaskSeries(seriesId: string, recurrence: TaskRecurrenceDraft, active?: boolean): Promise<TaskSeries> {
        const response = await fetch(`${TASK_SERIES_URL}/${seriesId}`, {
            method: 'PATCH',
            body: JSON.stringify(active === undefined ? recurrence : { ...recurrence, active }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) {
            throw new Error('Failed to update task recurrence');
        }
        clearTaskSeriesCache();
        clearTaskDetailsCache();
        invalidateTaskListCaches();
        invalidateResource('tasks');
        return response.json();
    },

    async stopTaskSeries(seriesId: string): Promise<void> {
        const response = await fetch(`${TASK_SERIES_URL}/${seriesId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to stop task recurrence');
        }
        clearTaskSeriesCache();
        clearTaskDetailsCache();
        invalidateTaskListCaches();
        invalidateResource('tasks');
    },

    async toggleTaskCompletion(taskId: string, completed?: boolean): Promise<Task> {
        const nextCompleted = completed ?? !(await this.getTask(taskId)).completed;
        return this.updateTask(taskId, { completed: nextCompleted });
    },

    async updateDescription(taskId: string, description: string): Promise<Task> {
        return this.updateTask(taskId, { description });
    },

    async deleteTask(taskId: string, { notifyResource = true }: DeleteTaskOptions = {}): Promise<void> {
        const response = await fetch(`${TASK_URL}/${taskId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to delete task');
        }
        invalidateTaskPomodoroStats(taskId);
        invalidateTaskListCaches();
        if (notifyResource) invalidateResource('tasks');
    },

    async deleteTaskOccurrence(taskId: string, { notifyResource = true }: DeleteTaskOptions = {}): Promise<void> {
        const response = await fetch(`${TASK_URL}/${taskId}/occurrence`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to delete task occurrence');
        }
        invalidateTaskPomodoroStats(taskId);
        invalidateTaskListCaches();
        if (notifyResource) invalidateResource('tasks');
    },

    async deleteTaskInstance(
        task: Pick<Task, 'taskId' | 'taskSeriesId'>,
        options: DeleteTaskOptions = {},
    ): Promise<void> {
        if (task.taskSeriesId) {
            await this.deleteTaskOccurrence(task.taskId, options);
            return;
        }
        await this.deleteTask(task.taskId, options);
    },

    clearCache(): void {
        clearTaskDataCaches();
    },

    // ============ Session Operations ============

    async startSession(taskId: string): Promise<void> {
        const response = await fetch(`${SESSION_URL}/start/${taskId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to start session');
        }
        invalidatePomodoroData(taskId);
    },

    async pauseSession(taskId: string): Promise<void> {
        const response = await fetch(`${SESSION_URL}/pause/${taskId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to pause session');
        }
        invalidatePomodoroData(taskId);
    },

    async unpauseSession(taskId: string): Promise<void> {
        const response = await fetch(`${SESSION_URL}/unpause/${taskId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to unpause session');
        }
        invalidatePomodoroData(taskId);
    },

    async endSession(taskId: string): Promise<void> {
        const response = await fetch(`${SESSION_URL}/end/${taskId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to end session');
        }
        invalidatePomodoroData(taskId);
    },

    // ============ Pomodoro Operations ============

    async startPomodoro(
        taskId: string,
        focusDuration: number,
        shortBreakDuration: number,
        longBreakDuration: number,
        numFocuses: number,
        longBreakCooldown: number,
        secondsMode: boolean
    ): Promise<void> {
        const response = await fetch(`${POMODORO_URL}/start`, {
            method: 'POST',
            body: JSON.stringify({
                taskId,
                focusDuration,
                shortBreakDuration,
                longBreakDuration,
                numFocuses,
                longBreakCooldown,
                secondsMode,
            }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });

        if (!response.ok) {
            throw new Error('Failed to start pomodoro');
        }
        invalidatePomodoroData(taskId);
        console.log("Started Pomodoro.");
    },

    async endPomodoro(taskId: string): Promise<PomodoroStatus> {
        const response = await fetch(`${POMODORO_URL}/end/${taskId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to end pomodoro');
        }
        invalidatePomodoroData(taskId);
        console.log("Ended Pomodoro.");
        return response.json();
    },

    async startNextPomodoroPhase(taskId: string): Promise<void> {
        const response = await fetch(`${POMODORO_URL}/phase/start/${taskId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to start the next Pomodoro phase');
        }
        invalidatePomodoroData(taskId);
    },

    async finishPomodoroBreak(taskId: string): Promise<void> {
        const response = await fetch(`${POMODORO_URL}/phase/finish-break/${taskId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to end the Pomodoro break');
        }
        invalidatePomodoroData(taskId);
    },

    // Returns the current user's active pomodoro, or null if none is running.
    async getActivePomodoro(): Promise<PomodoroStatus | null> {
        const response = await fetch(`${POMODORO_URL}/status`, {
            headers: getAuthHeaders(),
        });
        if (response.status === 204) return null;
        if (!response.ok) return null;
        return response.json();
    },
};
