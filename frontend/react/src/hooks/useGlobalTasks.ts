import {useContext, useEffect, useMemo} from 'react';
import {TaskContext} from '../contexts/TaskContext';
import type {TaskLoadMode} from './useTaskManager';

type UseGlobalTasksOptions = {
    taskPageMode?: boolean;
    prioritizeToday?: boolean;
};

export function useGlobalTasks({ taskPageMode = false, prioritizeToday = false }: UseGlobalTasksOptions = {}) {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useGlobalTasks must be used within TaskProvider');
    }

    // The TaskProvider owns the task snapshot for the whole authenticated app.
    // The service cache decides when it is stale; navigation must not turn a
    // cached snapshot into a forced network request.
    const {fetchTodayTasks, refreshTaskBuckets} = context;
    const loadMode: TaskLoadMode = taskPageMode ? 'taskPage' : 'all';
    useEffect(() => {
        if (prioritizeToday) void fetchTodayTasks();
        void refreshTaskBuckets(false, loadMode);
    }, [fetchTodayTasks, loadMode, prioritizeToday, refreshTaskBuckets]);

    return useMemo(() => {
        if (!taskPageMode || context.activeTaskLoadMode === 'taskPage') return context;

        return {
            ...context,
            allTasks: [],
            todayTasks: [],
            futureTasks: [],
            pastTasks: [],
            undatedTasks: [],
            highlightedTask: null,
            loading: context.error === null,
            tasksLoaded: false,
        };
    }, [context, taskPageMode]);
}
