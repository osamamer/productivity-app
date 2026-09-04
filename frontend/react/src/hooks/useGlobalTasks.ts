import {useContext, useEffect} from 'react';
import {TaskContext} from '../contexts/TaskContext';

export function useGlobalTasks() {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useGlobalTasks must be used within TaskProvider');
    }

    // Only task-aware pages load the shared task data. Entering one of these pages
    // is an explicit request for current data, so bypass the manager's short TTL.
    const {refreshTaskBuckets} = context;
    useEffect(() => {
        void refreshTaskBuckets(true);
    }, [refreshTaskBuckets]);

    return context;
}
