import {useContext, useEffect} from 'react';
import {TaskContext} from '../contexts/TaskContext';

export function useGlobalTasks() {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useGlobalTasks must be used within TaskProvider');
    }

    // Only task-aware pages load the shared task data. This keeps unrelated pages
    // from fetching the entire task list during every browser refresh.
    const {refreshTaskBuckets} = context;
    useEffect(() => {
        void refreshTaskBuckets();
    }, [refreshTaskBuckets]);

    return context;
}
