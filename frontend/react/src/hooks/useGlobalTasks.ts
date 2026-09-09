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

    // The TaskProvider owns the task snapshot for the whole authenticated app.
    // The service cache decides when it is stale; navigation must not turn a
    // cached snapshot into a forced network request.
    const {refreshTaskBuckets} = context;
    const loadMode: TaskLoadMode = taskPageMode ? 'taskPage' : 'all';
    useEffect(() => {
        void refreshTaskBuckets(false, loadMode);
    }, [loadMode, refreshTaskBuckets]);

    return context;
}
