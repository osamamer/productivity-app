import { useState, useCallback } from 'react';
import { Task } from '../types/Task';
import { taskService } from '../services/api';

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

    const addTaskToState = useCallback((task: Task) => {
        setAllTasks(prev => [task, ...prev]);

        const taskDate = new Date(task.scheduledPerformDateTime);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (taskDate.toDateString() === today.toDateString()) {
            setTodayTasks(prev => [task, ...prev]);
        } else if (taskDate > today) {
            setFutureTasks(prev => [task, ...prev]);
        } else {
            setPastTasks(prev => [task, ...prev]);
        }

        setHighlightedTask(prev => {
            if (!prev) {  // If there's no highlighted task
                return task;  // Set the new task
            }
            return prev;
        });
    }, []);

    const updateTaskInState = useCallback((taskId: string, updates: Partial<Task>) => {
        const updateInList = (tasks: Task[]) =>
            tasks.map(task =>
                task.taskId === taskId ? { ...task, ...updates } : task
            );

        setAllTasks(updateInList);
        setTodayTasks(updateInList);
        setFutureTasks(updateInList);
        setPastTasks(updateInList);

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
            setHighlightedTask(highlighted => {
                if (highlighted?.taskId !== taskId) return highlighted;
                return updated.length > 0 ? updated[0] : null;
            });
            return updated;
        });
        setTodayTasks(filterTask);
        setFutureTasks(filterTask);
        setPastTasks(filterTask);
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
        // State updaters
        addTaskToState,
        updateTaskInState,
        removeTaskFromState,
    };
}