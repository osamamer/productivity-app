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
            const tasks = await taskService.getAllTasks();
            setAllTasks(tasks);
            if (tasks.length > 0 && !highlightedTask) {
                setHighlightedTask(tasks[0]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
            console.error('Error fetching all tasks:', err);
        } finally {
            setLoading(false);
        }
    }, [highlightedTask]);

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

        if (highlightedTask?.taskId === taskId) {
            setHighlightedTask(prev => prev ? { ...prev, ...updates } : null);
        }
    }, [highlightedTask]);

    const removeTaskFromState = useCallback((taskId: string) => {
        const filterTask = (tasks: Task[]) =>
            tasks.filter(task => task.taskId !== taskId);

        setAllTasks(filterTask);
        setTodayTasks(filterTask);
        setFutureTasks(filterTask);
        setPastTasks(filterTask);

        if (highlightedTask?.taskId === taskId) {
            const remaining = allTasks.filter(t => t.taskId !== taskId);
            setHighlightedTask(remaining.length > 0 ? remaining[0] : null);
        }
    }, [highlightedTask, allTasks]);

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