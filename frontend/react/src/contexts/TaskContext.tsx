import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useTaskManager } from '../hooks/useTaskManager';

type TaskManagerType = ReturnType<typeof useTaskManager>;

const TaskContext = createContext<TaskManagerType | undefined>(undefined);

interface TaskProviderProps {
    children: ReactNode;
}

export function TaskProvider({ children }: TaskProviderProps) {
    const taskManager = useTaskManager();

    // Fetch once when app loads
    useEffect(() => {
        taskManager.fetchAllTasks();
        taskManager.fetchTodayTasks();
        taskManager.fetchFutureTasks();
        taskManager.fetchPastTasks();
    }, []);

    return (
        <TaskContext.Provider value={taskManager}>
            {children}
        </TaskContext.Provider>
    );
}

// Custom hook to use the global task state
export function useGlobalTasks() {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useGlobalTasks must be used within TaskProvider');
    }
    return context;
}