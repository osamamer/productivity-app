import { useState, useCallback, useEffect } from 'react';
import { Task } from '../types/Task';
import { taskService } from '../services/api';

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

export function useTaskManager() {
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [todayTasks, setTodayTasks] = useState<Task[]>([]);
    const [futureTasks, setFutureTasks] = useState<Task[]>([]);
    const [pastTasks, setPastTasks] = useState<Task[]>([]);
    const [highlightedTask, setHighlightedTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAllTasks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const tasks = await taskService.getAllMainTasks();
            setAllTasks(tasks);
            const grouped = splitTasksByDate(tasks);
            setTodayTasks(grouped.today);
            setFutureTasks(grouped.future);
            setPastTasks(grouped.past);
            // Functional update: only set highlighted task if one isn't already selected,
            // without needing highlightedTask in the dependency array.
            if (tasks.length > 0) {
                setHighlightedTask(prev => prev ?? tasks[tasks.length - 1]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
            console.error('Error fetching all tasks:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTodayTasks = useCallback(async () => {
        try {
            const tasks = await taskService.getTodayTasks();
            setTodayTasks(tasks);
        } catch (err) {
            console.error('Error fetching today tasks:', err);
        }
    }, []);

    const fetchFutureTasks = useCallback(async () => {
        try {
            const tasks = await taskService.getFutureTasks();
            setFutureTasks(tasks);
        } catch (err) {
            console.error('Error fetching future tasks:', err);
        }
    }, []);

    const fetchPastTasks = useCallback(async () => {
        try {
            const tasks = await taskService.getPastTasks();
            setPastTasks(tasks);
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
        setAllTasks(prev => {
            const updated = [task, ...prev];
            const grouped = splitTasksByDate(updated);
            setTodayTasks(grouped.today);
            setFutureTasks(grouped.future);
            setPastTasks(grouped.past);
            return updated;
        });

        setHighlightedTask(prev => {
            if (!prev) {  // If there's no highlighted task
                return task;  // Set the new task
            }
            return prev;
        });
    }, []);

    const updateTaskInState = useCallback((taskId: string, updates: Partial<Task>) => {
        setAllTasks(prev => {
            const updated = prev.map(task =>
                task.taskId === taskId ? { ...task, ...updates } : task
            );
            const grouped = splitTasksByDate(updated);
            setTodayTasks(grouped.today);
            setFutureTasks(grouped.future);
            setPastTasks(grouped.past);
            return updated;
        });

        // Functional update: check and update highlighted task without closing over it.
        setHighlightedTask(prev => prev?.taskId === taskId ? { ...prev, ...updates } : prev);
    }, []);

    const removeTaskFromState = useCallback((taskId: string) => {
        const filterTask = (tasks: Task[]) =>
            tasks.filter(task => task.taskId !== taskId);

        // Update allTasks via functional form so we have the latest list available
        // to pick a replacement highlighted task — no need to close over allTasks.
        setAllTasks(prev => {
            const updated = filterTask(prev);
            const grouped = splitTasksByDate(updated);
            setTodayTasks(grouped.today);
            setFutureTasks(grouped.future);
            setPastTasks(grouped.past);
            setHighlightedTask(highlighted => {
                if (highlighted?.taskId !== taskId) return highlighted;
                return updated.length > 0 ? updated[0] : null;
            });
            return updated;
        });
    }, []);

    return {
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
    };
}
