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
};

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

function withTaskBuckets(previous: TaskState, allTasks: Task[]): TaskState {
    const grouped = splitTasksByDate(allTasks);

    return {
        ...previous,
        allTasks,
        todayTasks: reuseTaskList(previous.todayTasks, grouped.today),
        futureTasks: reuseTaskList(previous.futureTasks, grouped.future),
        pastTasks: reuseTaskList(previous.pastTasks, grouped.past),
        undatedTasks: reuseTaskList(previous.undatedTasks, grouped.undated),
    };
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
            const tasks = await taskService.getTodayTasks();
            if (taskDataGenerationRef.current !== requestDataGeneration) return;
            setTaskState(prev => {
                // Home can render this smaller snapshot while the complete
                // task list is still being reconciled in the background.
                if (prev.allTasks.length === 0) {
                    return withTaskBuckets(prev, tasks);
                }
                const nextTodayTasks = reuseTaskList(prev.todayTasks, tasks);
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

    useEffect(() => subscribeToResourceInvalidation('stats', () => {
        invalidatePendingTaskLoads();
        void refreshTaskBuckets(false, allTasksLoadModeRef.current);
    }), [invalidatePendingTaskLoads, refreshTaskBuckets]);

    useEffect(() => subscribeToResourceInvalidation('tasks', () => {
        // Mutations invalidate the task-service cache before emitting this
        // signal. Session/stat events may emit the same signal without
        // changing task rows, so let the shared cache decide whether a GET is
        // needed instead of forcing one for every event.
        invalidatePendingTaskLoads();
        void refreshTaskBuckets(false, allTasksLoadModeRef.current);
    }), [invalidatePendingTaskLoads, refreshTaskBuckets]);

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

    const replaceTaskInState = useCallback((taskId: string, replacement: Task) => {
        setTaskState(prev => {
            const taskIndex = prev.allTasks.findIndex(task => task.taskId === taskId);
            if (taskIndex === -1) return prev;

            const updatedTasks = [...prev.allTasks];
            updatedTasks[taskIndex] = replacement;
            const next = withTaskBuckets(prev, updatedTasks);

            return {
                ...next,
                highlightedTask: prev.highlightedTask?.taskId === taskId
                    ? replacement
                    : prev.highlightedTask,
            };
        });
    }, []);

    const updateTaskInState = useCallback((taskId: string, updates: Partial<Task>) => {
        setTaskState(prev => {
            const taskIndex = prev.allTasks.findIndex(task => task.taskId === taskId);
            if (taskIndex === -1) return prev;

            const updatedTask = { ...prev.allTasks[taskIndex], ...updates };
            const updatedTasks = [...prev.allTasks];
            updatedTasks[taskIndex] = updatedTask;
            const next = withTaskBuckets(prev, updatedTasks);

            return {
                ...next,
                highlightedTask: prev.highlightedTask?.taskId === taskId
                    ? { ...prev.highlightedTask, ...updates }
                    : prev.highlightedTask,
            };
        });
    }, []);

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
        setTaskState(prev => {
            const orderedTaskIdSet = new Set(orderedTaskIds);
            const reorderedTasks = prev.allTasks.filter(task => orderedTaskIdSet.has(task.taskId));
            const taskById = new Map(reorderedTasks.map(task => [task.taskId, task]));
            let nextSelectedTask = 0;

            const updatedTasks = prev.allTasks.map(task => {
                if (!orderedTaskIdSet.has(task.taskId)) return task;
                const reorderedTask = taskById.get(orderedTaskIds[nextSelectedTask]);
                nextSelectedTask += 1;
                return reorderedTask ?? task;
            });

            return withTaskBuckets(prev, updatedTasks);
        });
    }, []);

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
        removeTasksFromState,
        removeTaskFromState,
        reorderTasksInState,
    ]);
}
