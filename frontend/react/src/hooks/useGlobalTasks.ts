import {useContext, useEffect} from 'react';
import {TaskContext} from '../contexts/TaskContext';
import type {TaskLoadMode} from './useTaskManager';

type UseGlobalTasksOptions = {
    taskPageMode?: boolean;
};

export function useGlobalTasks({ taskPageMode = false }: UseGlobalTasksOptions = {}) {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useGlobalTasks must be used within TaskProvider');
    }

    // Only task-aware pages load the shared task data. Entering one of these pages
    // is an explicit request for current data, so bypass the manager's short TTL.
    const {refreshTaskBuckets} = context;
    const loadMode: TaskLoadMode = taskPageMode ? 'taskPage' : 'all';
    useEffect(() => {
        void refreshTaskBuckets(true, loadMode);
    }, [loadMode, refreshTaskBuckets]);

    return context;
}
