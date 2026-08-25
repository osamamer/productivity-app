import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Task } from '../types/Task';
import { taskService } from '../services/api';

type TaskState = {
    allTasks: Task[];
    todayTasks: Task[];
    futureTasks: Task[];
    pastTasks: Task[];
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
                return acc;
            }

            const taskDate = new Date(task.scheduledPerformDateTime);

            if (Number.isNaN(taskDate.getTime())) {
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
        { today: [] as Task[], future: [] as Task[], past: [] as Task[] }
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
    };
}

export function useTaskManager() {
    const [taskState, setTaskState] = useState<TaskState>({
        allTasks: [],
        todayTasks: [],
        futureTasks: [],
        pastTasks: [],
        highlightedTask: null,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const allTasksRequestRef = useRef<Promise<void> | null>(null);

    const {
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        highlightedTask,
    } = taskState;

    const setHighlightedTask = useCallback((task: Task | null) => {
        setTaskState(prev => ({ ...prev, highlightedTask: task }));
    }, []);

    const fetchAllTasks = useCallback(async () => {
        if (allTasksRequestRef.current) {
            return allTasksRequestRef.current;
        }

        const request = (async () => {
            try {
                setLoading(true);
                setError(null);
                const tasks = await taskService.getAllMainTasks();
                setTaskState(prev => {
                    const next = withTaskBuckets(prev, tasks);
                    return {
                        ...next,
                        // Keep the user's current selection across refreshes. On the
                        // first load, select the same fallback task as before.
                        highlightedTask: prev.highlightedTask ?? tasks[tasks.length - 1] ?? null,
                    };
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
                console.error('Error fetching all tasks:', err);
            } finally {
                setLoading(false);
            }
        })();

        allTasksRequestRef.current = request;
        try {
            await request;
        } finally {
            if (allTasksRequestRef.current === request) {
                allTasksRequestRef.current = null;
            }
        }
    }, []);

    const fetchTodayTasks = useCallback(async () => {
        try {
            const tasks = await taskService.getTodayTasks();
            setTaskState(prev => ({ ...prev, todayTasks: tasks }));
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

    const refreshTaskBuckets = useCallback(async () => {
        await fetchAllTasks();
    }, [fetchAllTasks]);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const scheduleNextRefresh = () => {
            const now = new Date();
            const nextMidnight = new Date(now);
            nextMidnight.setHours(24, 0, 0, 0);
            const delay = nextMidnight.getTime() - now.getTime();

            timeoutId = setTimeout(async () => {
                try {
                    await refreshTaskBuckets();
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

    const removeTaskFromState = useCallback((taskId: string) => {
        setTaskState(prev => {
            const updatedTasks = prev.allTasks.filter(task => task.taskId !== taskId);
            if (updatedTasks.length === prev.allTasks.length) return prev;

            const next = withTaskBuckets(prev, updatedTasks);
            return {
                ...next,
                highlightedTask: prev.highlightedTask?.taskId === taskId
                    ? updatedTasks[0] ?? null
                    : prev.highlightedTask,
            };
        });
    }, []);

    return useMemo(() => ({
        // State
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        highlightedTask,
        loading,
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
        updateTaskInState,
        removeTaskFromState,
    }), [
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        highlightedTask,
        loading,
        error,
        setHighlightedTask,
        fetchAllTasks,
        fetchTodayTasks,
        fetchFutureTasks,
        fetchPastTasks,
        refreshTaskBuckets,
        addTaskToState,
        updateTaskInState,
        removeTaskFromState,
    ]);
}
