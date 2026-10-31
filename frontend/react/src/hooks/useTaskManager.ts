import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Task } from '../types/Task';
import { TASK_PAGE_BATCH_SIZE, taskService } from '../services/api';
import { subscribeToResourceInvalidation } from '../services/cache/resourceInvalidation';
import { getShowCompletedHomeTasks } from '../services/utils/homePreferences';

export type TaskLoadMode = 'all' | 'taskPage';

type TaskState = {
    allTasks: Task[];
    todayTasks: Task[];
    futureTasks: Task[];
    pastTasks: Task[];
    undatedTasks: Task[];
    highlightedTask: Task | null;
    bucketDateKey: string;
};

function localDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function splitTasksByDate(tasks: Task[]) {
    const today = startOfToday();

    return tasks.reduce(
        (acc, task) => {
            if (!task.scheduledPerformDateTime) {
                acc.undated.push(task);
                return acc;
            }

            const taskDate = new Date(task.scheduledPerformDateTime);

            if (Number.isNaN(taskDate.getTime())) {
                acc.undated.push(task);
                return acc;
            }

            if (taskDate.toDateString() === today.toDateString()) {
                acc.today.push(task);
            } else if (taskDate > today) {
                acc.future.push(task);
            } else {
                acc.past.push(task);
            }

            return acc;
        },
        {
            today: [] as Task[],
            future: [] as Task[],
            past: [] as Task[],
            undated: [] as Task[],
        }
    );
}

function reuseTaskList(previous: Task[], next: Task[]): Task[] {
    if (previous.length !== next.length) return next;

    for (let index = 0; index < previous.length; index += 1) {
        if (previous[index] !== next[index]) return next;
    }

    return previous;
}

function uniqueTasksById(tasks: Task[]): Task[] {
    const tasksById = new Map<string, Task>();
    tasks.forEach(task => tasksById.set(task.taskId, task));
    return [...tasksById.values()];
}

function withTaskBuckets(previous: TaskState, allTasks: Task[]): TaskState {
    const uniqueTasks = uniqueTasksById(allTasks);
    const grouped = splitTasksByDate(uniqueTasks);

    return {
        ...previous,
        allTasks: uniqueTasks,
        todayTasks: reuseTaskList(previous.todayTasks, grouped.today),
        futureTasks: reuseTaskList(previous.futureTasks, grouped.future),
        pastTasks: reuseTaskList(previous.pastTasks, grouped.past),
        undatedTasks: reuseTaskList(previous.undatedTasks, grouped.undated),
        bucketDateKey: localDateKey(),
    };
}

function withStableTaskBuckets(previous: TaskState, allTasks: Task[]): TaskState {
    if (previous.bucketDateKey !== localDateKey()) return withTaskBuckets(previous, allTasks);

    const reorderBucket = (bucket: Task[]) => {
        const taskIds = new Set(bucket.map(task => task.taskId));
        return reuseTaskList(bucket, allTasks.filter(task => taskIds.has(task.taskId)));
    };

    return {
        ...previous,
        allTasks,
        todayTasks: reorderBucket(previous.todayTasks),
        futureTasks: reorderBucket(previous.futureTasks),
        pastTasks: reorderBucket(previous.pastTasks),
        undatedTasks: reorderBucket(previous.undatedTasks),
    };
}

function reorderTaskSnapshot(tasks: Task[], orderedTaskIds: string[]): Task[] {
    const taskIdSet = new Set(orderedTaskIds);
    const reorderedTasks = tasks.filter(task => taskIdSet.has(task.taskId));
    const taskById = new Map(reorderedTasks.map(task => [task.taskId, task]));
    let nextSelectedTask = 0;
    let changed = false;

    const nextTasks = tasks.map(task => {
        if (!taskIdSet.has(task.taskId)) return task;

        const reorderedTask = taskById.get(orderedTaskIds[nextSelectedTask]);
        nextSelectedTask += 1;
        if (reorderedTask && reorderedTask !== task) changed = true;
        return reorderedTask ?? task;
    });

    return changed ? nextTasks : tasks;
}

type TaskStateChange = { taskId: string; updates: Partial<Task> };

function mergeTaskUpdates(task: Task, updates: Partial<Task>): Task {
    if (Object.entries(updates).every(([key, value]) => Object.is(task[key as keyof Task], value))) {
        return task;
    }

    return { ...task, ...updates };
}

function createInitialTaskState(): TaskState {
    const cachedTasks = taskService.getCachedMainTasks()
        ?? taskService.getCachedTodayTasks()
        ?? [];
    const state = {
        allTasks: [],
        todayTasks: [],
        futureTasks: [],
        pastTasks: [],
        undatedTasks: [],
        highlightedTask: null,
        bucketDateKey: localDateKey(),
    } satisfies TaskState;
    const next = withTaskBuckets(state, cachedTasks);

    return {
        ...next,
        highlightedTask: cachedTasks[cachedTasks.length - 1] ?? null,
    };
}

export function useTaskManager() {
    const [taskState, setTaskState] = useState<TaskState>(createInitialTaskState);
    const [loading, setLoading] = useState(() => taskService.getCachedMainTasks() === undefined);
    const [tasksLoaded, setTasksLoaded] = useState(() => taskService.getCachedMainTasks() !== undefined);
    const [todayTasksLoaded, setTodayTasksLoaded] = useState(
        () => taskService.getCachedMainTasks() !== undefined || taskService.getCachedTodayTasks() !== undefined,
    );
    const [taskLoadVersion, setTaskLoadVersion] = useState(0);
    const [taskPageHasMoreFutureTasks, setTaskPageHasMoreFutureTasks] = useState(false);
    const [taskPageHasMorePastTasks, setTaskPageHasMorePastTasks] = useState(false);
    const [activeTaskLoadMode, setActiveTaskLoadMode] = useState<TaskLoadMode>('all');
    const [allTasksSynchronized, setAllTasksSynchronized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const taskRequestsRef = useRef(new Map<TaskLoadMode, Promise<void>>());
    const taskRequestIdsRef = useRef(new Map<TaskLoadMode, number>());
    const nextTaskRequestIdRef = useRef(0);
    const taskDataGenerationRef = useRef(0);
    const allTasksLoadModeRef = useRef<TaskLoadMode>('all');
    const loadedTaskModeRef = useRef<TaskLoadMode>('all');
    const tasksLoadedRef = useRef(tasksLoaded);
    const todayTasksLoadedRef = useRef(todayTasksLoaded);
    const loadedTaskSnapshotRef = useRef(taskState.allTasks);

    const {
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        undatedTasks,
        highlightedTask,
    } = taskState;

    const setHighlightedTask = useCallback((task: Task | null) => {
        setTaskState(prev => ({ ...prev, highlightedTask: task }));
    }, []);

    const fetchAllTasks = useCallback(async (
        force = false,
        loadMode: TaskLoadMode = allTasksLoadModeRef.current,
    ) => {
        allTasksLoadModeRef.current = loadMode;
        const pendingRequest = taskRequestsRef.current.get(loadMode);
        if (pendingRequest) return pendingRequest;

        // Cache invalidation cannot cancel a fetch already in progress. Track
        // both the request and its data generation so late responses cannot
        // replace a newer snapshot.
        const requestId = ++nextTaskRequestIdRef.current;
        const requestDataGeneration = taskDataGenerationRef.current;
        taskRequestIdsRef.current.set(loadMode, requestId);
        if (loadMode === 'all') setAllTasksSynchronized(false);
        const isCurrentRequest = () => (
            allTasksLoadModeRef.current === loadMode
            && taskRequestIdsRef.current.get(loadMode) === requestId
            && taskDataGenerationRef.current === requestDataGeneration
        );

        const request = (async () => {
            const showLoading = !tasksLoadedRef.current;
            let requestSucceeded = false;
            try {
                if (showLoading) setLoading(true);
                setError(null);
                const completedFilter = loadMode === 'taskPage' && !getShowCompletedHomeTasks()
                    ? false
                    : undefined;
                const taskPageSnapshot = loadMode === 'taskPage'
                    ? await taskService.getTaskPageInitialSnapshot(
                        TASK_PAGE_BATCH_SIZE,
                        completedFilter,
                        force,
                    )
                    : null;
                const tasks = taskPageSnapshot?.tasks ?? await taskService.getAllMainTasks(force);

                if (!isCurrentRequest()) return;

                const snapshotChanged = loadedTaskModeRef.current !== loadMode
                    || loadedTaskSnapshotRef.current !== tasks;
                loadedTaskModeRef.current = loadMode;
                loadedTaskSnapshotRef.current = tasks;
                setActiveTaskLoadMode(loadMode);
                if (taskPageSnapshot) {
                    setTaskPageHasMoreFutureTasks(taskPageSnapshot.hasMoreFutureTasks);
                    setTaskPageHasMorePastTasks(taskPageSnapshot.hasMorePastTasks);
                }
                if (snapshotChanged) {
                    setTaskState(prev => {
                        const next = withTaskBuckets(prev, tasks);
                        if (loadMode === 'all' && todayTasksLoadedRef.current && prev.todayTasks.length > 0) {
                            next.todayTasks = prev.todayTasks;
                        }
                        return {
                            ...next,
                            // Keep the user's current selection across refreshes. On the
                            // first load, select the same fallback task as before.
                            highlightedTask: prev.highlightedTask
                                ?? (loadMode === 'taskPage' ? null : tasks[tasks.length - 1] ?? null),
                        };
                    });
                    setTaskLoadVersion(previous => previous + 1);
                }
                requestSucceeded = true;
            } catch (err) {
                if (isCurrentRequest()) {
                    setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
                }
                console.error('Error fetching all tasks:', err);
            } finally {
                if (isCurrentRequest()) {
                    if (showLoading) setLoading(false);
                    tasksLoadedRef.current = true;
                    setTasksLoaded(true);
                    if (loadMode === 'all' && requestSucceeded) setAllTasksSynchronized(true);
                }
            }
        })();

        taskRequestsRef.current.set(loadMode, request);
        try {
            await request;
        } finally {
            if (taskRequestsRef.current.get(loadMode) === request) {
                taskRequestsRef.current.delete(loadMode);
            }
        }
    }, []);

    const fetchTodayTasks = useCallback(async () => {
        const requestDataGeneration = taskDataGenerationRef.current;
        try {
            const mainTasks = uniqueTasksById(await taskService.getAllMainTasks());
            const tasks = splitTasksByDate(mainTasks).today;
            if (taskDataGenerationRef.current !== requestDataGeneration) return;
            todayTasksLoadedRef.current = true;
            setTaskState(prev => {
                // Home can render this smaller snapshot while the complete
                // task list is still being reconciled in the background.
                if (prev.allTasks.length === 0) {
                    return withTaskBuckets(prev, tasks);
                }
                // A Today request can race a schedule update; trust the canonical snapshot for known task IDs.
                const allTasksById = new Map(prev.allTasks.map(task => [task.taskId, task] as const));
                const todayTasksById = new Map(
                    splitTasksByDate(prev.allTasks).today.map(task => [task.taskId, task] as const),
                );
                const reconciledTodayTasks = new Map<string, Task>();
                tasks.forEach(task => {
                    const currentTask = allTasksById.get(task.taskId);
                    if (!currentTask) {
                        reconciledTodayTasks.set(task.taskId, task);
                    } else if (todayTasksById.has(task.taskId)) {
                        reconciledTodayTasks.set(task.taskId, currentTask);
                    }
                });
                todayTasksById.forEach((task, taskId) => {
                    if (!reconciledTodayTasks.has(taskId)) reconciledTodayTasks.set(taskId, task);
                });
                const nextTodayTasks = reuseTaskList(prev.todayTasks, [...reconciledTodayTasks.values()]);
                return nextTodayTasks === prev.todayTasks
                    ? prev
                    : { ...prev, todayTasks: nextTodayTasks };
            });
            setTodayTasksLoaded(true);
        } catch (err) {
            console.error('Error fetching today tasks:', err);
        }
    }, []);

    const fetchFutureTasks = useCallback(async () => {
        try {
            const tasks = await taskService.getFutureTasks();
            setTaskState(prev => ({ ...prev, futureTasks: tasks }));
        } catch (err) {
            console.error('Error fetching future tasks:', err);
        }
    }, []);

    const fetchPastTasks = useCallback(async () => {
        try {
            const tasks = await taskService.getPastTasks();
            setTaskState(prev => ({ ...prev, pastTasks: tasks }));
        } catch (err) {
            console.error('Error fetching past tasks:', err);
        }
    }, []);

    const refreshTaskBuckets = useCallback(async (
        force = false,
        loadMode: TaskLoadMode = allTasksLoadModeRef.current,
    ) => {
        await fetchAllTasks(force, loadMode);
    }, [fetchAllTasks]);

    const invalidatePendingTaskLoads = useCallback(() => {
        // Start a fresh request after invalidation instead of waiting for an
        // older promise whose response may have been captured before a delete.
        taskDataGenerationRef.current += 1;
        taskRequestsRef.current.clear();
        taskRequestIdsRef.current.clear();
        setAllTasksSynchronized(false);
    }, []);

    useEffect(() => subscribeToResourceInvalidation('tasks', () => {
        // Mutations invalidate the task-service cache before emitting this
        // signal. Linked stat updates are forwarded here after their write has
        // completed so task views and project counts refresh together.
        invalidatePendingTaskLoads();
        void fetchTodayTasks();
        void refreshTaskBuckets(false, allTasksLoadModeRef.current);
    }), [fetchTodayTasks, invalidatePendingTaskLoads, refreshTaskBuckets]);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const scheduleNextRefresh = () => {
            const now = new Date();
            const nextMidnight = new Date(now);
            nextMidnight.setHours(24, 0, 0, 0);
            const delay = nextMidnight.getTime() - now.getTime();

            timeoutId = setTimeout(async () => {
                try {
                await refreshTaskBuckets(true, allTasksLoadModeRef.current);
                } finally {
                    scheduleNextRefresh();
                }
            }, delay);
        };

        scheduleNextRefresh();

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [refreshTaskBuckets]);

    const addTaskToState = useCallback((task: Task) => {
        setTaskState(prev => {
            const next = withTaskBuckets(prev, [task, ...prev.allTasks]);
            return {
                ...next,
                highlightedTask: prev.highlightedTask ?? task,
            };
        });
    }, []);

    const appendTasksToState = useCallback((tasks: Task[]) => {
        if (tasks.length === 0) return;

        setTaskState(prev => {
            const knownTaskIds = new Set(prev.allTasks.map(task => task.taskId));
            const additions = tasks.filter(task => !knownTaskIds.has(task.taskId));
            if (additions.length === 0) return prev;
            return withTaskBuckets(prev, [...prev.allTasks, ...additions]);
        });
    }, []);

    const updateTasksInState = useCallback((changes: TaskStateChange[], orderedTaskIds?: string[]) => {
        if (changes.length === 0 && !orderedTaskIds) return;

        setTaskState(prev => {
            const updatesByTaskId = new Map(changes.map(change => [change.taskId, change.updates]));
            let scheduleChanged = false;
            let taskIdChanged = false;
            const updatedTasks = prev.allTasks.map(task => {
                const updates = updatesByTaskId.get(task.taskId);
                if (!updates) return task;

                const updatedTask = mergeTaskUpdates(task, updates);
                if (updatedTask.taskId !== task.taskId) taskIdChanged = true;
                if (updatedTask !== task
                    && updatedTask.scheduledPerformDateTime !== task.scheduledPerformDateTime) {
                    scheduleChanged = true;
                }
                return updatedTask;
            });
            const taskRecordsChanged = updatedTasks.some((task, index) => task !== prev.allTasks[index]);
            if (!taskRecordsChanged && !orderedTaskIds) return prev;

            const orderedTasks = orderedTaskIds
                ? reorderTaskSnapshot(updatedTasks, orderedTaskIds)
                : updatedTasks;
            const orderChanged = orderedTasks.some((task, index) => task !== updatedTasks[index]);
            if (!taskRecordsChanged && !orderChanged) return prev;

            const next = scheduleChanged || taskIdChanged
                ? withTaskBuckets(prev, orderedTasks)
                : withStableTaskBuckets(prev, orderedTasks);
            const highlightedTask = prev.highlightedTask
                ? updatesByTaskId.has(prev.highlightedTask.taskId)
                    ? mergeTaskUpdates(prev.highlightedTask, updatesByTaskId.get(prev.highlightedTask.taskId)!)
                    : prev.highlightedTask
                : null;

            return {
                ...next,
                highlightedTask,
            };
        });
    }, []);

    const replaceTaskInState = useCallback((taskId: string, replacement: Task) => {
        updateTasksInState([{ taskId, updates: replacement }]);
    }, [updateTasksInState]);

    const updateTaskInState = useCallback((taskId: string, updates: Partial<Task>) => {
        updateTasksInState([{ taskId, updates }]);
    }, [updateTasksInState]);

    const removeTasksFromState = useCallback((taskIds: string[]) => {
        if (taskIds.length === 0) return;
        const taskIdSet = new Set(taskIds);

        setTaskState(prev => {
            const updatedTasks = prev.allTasks.filter(task => !taskIdSet.has(task.taskId));
            if (updatedTasks.length === prev.allTasks.length) return prev;

            const next = withTaskBuckets(prev, updatedTasks);
            return {
                ...next,
                highlightedTask: prev.highlightedTask && taskIdSet.has(prev.highlightedTask.taskId)
                    ? updatedTasks[0] ?? null
                    : prev.highlightedTask,
            };
        });
    }, []);

    const removeTaskFromState = useCallback((taskId: string) => {
        removeTasksFromState([taskId]);
    }, [removeTasksFromState]);

    const reorderTasksInState = useCallback((orderedTaskIds: string[]) => {
        updateTasksInState([], orderedTaskIds);
    }, [updateTasksInState]);

    return useMemo(() => ({
        // State
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        undatedTasks,
        highlightedTask,
        loading,
        tasksLoaded,
        todayTasksLoaded,
        taskLoadVersion,
        taskPageHasMoreFutureTasks,
        taskPageHasMorePastTasks,
        activeTaskLoadMode,
        allTasksSynchronized,
        error,
        // Setters
        setHighlightedTask,
        // Fetchers
        fetchAllTasks,
        fetchTodayTasks,
        fetchFutureTasks,
        fetchPastTasks,
        refreshTaskBuckets,
        // State updaters
        addTaskToState,
        appendTasksToState,
        replaceTaskInState,
        updateTaskInState,
        updateTasksInState,
        removeTasksFromState,
        removeTaskFromState,
        reorderTasksInState,
    }), [
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        undatedTasks,
        highlightedTask,
        loading,
        tasksLoaded,
        todayTasksLoaded,
        taskLoadVersion,
        taskPageHasMoreFutureTasks,
        taskPageHasMorePastTasks,
        activeTaskLoadMode,
        allTasksSynchronized,
        error,
        setHighlightedTask,
        fetchAllTasks,
        fetchTodayTasks,
        fetchFutureTasks,
        fetchPastTasks,
        refreshTaskBuckets,
        addTaskToState,
        appendTasksToState,
        replaceTaskInState,
        updateTaskInState,
        updateTasksInState,
        removeTasksFromState,
        removeTaskFromState,
        reorderTasksInState,
    ]);
}
