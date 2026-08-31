import React, { createContext, ReactNode } from 'react';
import { useTaskManager } from '../hooks/useTaskManager';

type TaskManagerType = ReturnType<typeof useTaskManager>;

export const TaskContext = createContext<TaskManagerType | undefined>(undefined);

interface TaskProviderProps {
    children: ReactNode;
}

export function TaskProvider({ children }: TaskProviderProps) {
    const taskManager = useTaskManager();

    return (
        <TaskContext.Provider value={taskManager}>
            {children}
        </TaskContext.Provider>
    );
}
