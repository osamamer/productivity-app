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
const TODAY_TASKS_TTL_MS = 30 * 1000;
export const TASK_PAGE_BATCH_SIZE = 30;
const todayTasksCache = new CachedResource<Task[]>({ ttlMs: TODAY_TASKS_TTL_MS, maxEntries: 4 });
const taskPageInitialCache = new CachedResource<Task[]>({ ttlMs: TODAY_TASKS_TTL_MS, maxEntries: 4 });
const taskPageBatchCache = new CachedResource<Task[]>({ ttlMs: TODAY_TASKS_TTL_MS, maxEntries: 12 });

function todayTasksCacheKey(): string {
    return `${getAuthCacheScope()}:today-tasks`;
}

function invalidateTodayTasksCache(): void {
    todayTasksCache.invalidate(todayTasksCacheKey());
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
    todayTasksCache.clear();
    invalidateTaskPageCache();
    clearTaskSubtasksCache();
    clearTaskSeriesCache();
    clearTaskDetailsCache();
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

export const taskService = {

    // ============ Task Queries ============

    async getAllMainTasks(): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}/main`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch all tasks');
        }
        return response.json();
    },

    async getTodayTasks(): Promise<Task[]> {
        return todayTasksCache.get(todayTasksCacheKey(), async () => {
            const response = await fetch(`${TASK_URL}/today`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error('Failed to fetch today tasks');
            }
            return response.json() as Promise<Task[]>;
        });
    },

    async getTaskPageInitialTasks(batchSize = TASK_PAGE_BATCH_SIZE, completed?: boolean): Promise<Task[]> {
        const completionFilter = completed === undefined ? 'all' : String(completed);
        const cacheKey = `${getAuthCacheScope()}:task-page-initial:${completionFilter}:${batchSize}`;
        return taskPageInitialCache.get(cacheKey, async () => {
            const [today, future, past, undated] = await Promise.all([
                this.getTodayTasks(),
                fetchTaskPeriod('FUTURE', batchSize, 0, completed),
                fetchTaskPeriod('PAST', batchSize, 0, completed),
                fetch(`${TASK_URL}/undated`, { headers: getAuthHeaders() })
                    .then(response => {
                        if (!response.ok) throw new Error('Failed to fetch undated tasks');
                        return response.json() as Promise<Task[]>;
                    }),
            ]);
            return [...today, ...future, ...past, ...undated];
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
        invalidateTodayTasksCache();
        invalidateTaskPageCache();
        return response.json();
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
            const [subtasks, taskSeries] = await Promise.all([
                this.getSubtasks(task.taskId),
                this.getTaskSeries(task.taskId),
            ]);
            return { task, subtasks, taskSeries };
        });

        if (details.task !== task) {
            const updated = { ...details, task };
            setCachedTaskDetails(task.taskId, updated);
            return updated;
        }
        return details;
    },

    /**
     * Warm the fields that Home renders only after a task row is expanded.
     * Each task is stored as one complete detail record for Home to consume.
     */
    async prefetchTodayTaskDetails(tasks: Task[]): Promise<void> {
        const results = await Promise.allSettled(
            tasks
                .filter(task => !task.parentId)
                .map(task => this.getTaskDetails(task)),
        );

        results.forEach(result => {
            if (result.status === 'rejected') {
                console.error('Failed to warm Home task details:', result.reason);
            }
        });
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
        invalidateTodayTasksCache();
        invalidateTaskPageCache();
        return response.json();
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
        invalidateTodayTasksCache();
        invalidateTaskPageCache();
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

    async getTaskSeries(taskId: string): Promise<TaskSeries | null> {
        return loadTaskSeries(taskId, async () => {
            const response = await fetch(`${TASK_URL}/${taskId}/recurrence`, {
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
        invalidateTodayTasksCache();
        invalidateTaskPageCache();
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
        invalidateTodayTasksCache();
        invalidateTaskPageCache();
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
        invalidateTodayTasksCache();
        invalidateTaskPageCache();
        invalidateResource('tasks');
    },

    async toggleTaskCompletion(taskId: string, completed?: boolean): Promise<Task> {
        const nextCompleted = completed ?? !(await this.getTask(taskId)).completed;
        return this.updateTask(taskId, { completed: nextCompleted });
    },

    async updateDescription(taskId: string, description: string): Promise<Task> {
        return this.updateTask(taskId, { description });
    },

    async deleteTask(taskId: string): Promise<void> {
        const response = await fetch(`${TASK_URL}/${taskId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to delete task');
        }
        invalidateTaskPomodoroStats(taskId);
        invalidateTodayTasksCache();
        invalidateTaskPageCache();
        invalidateResource('tasks');
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
