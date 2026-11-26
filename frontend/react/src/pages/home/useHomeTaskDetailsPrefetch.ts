import { useEffect } from 'react';
import { taskService } from '../../services/api';
import type { Task } from '../../types/Task';

const MAX_CONCURRENT_REQUESTS = 4;

/**
 * Warms the task details cache for the rows Home shows, so opening one is instant. Today's rows
 * go first; older rows still get some of the requests so a long today list cannot starve them.
 */
export function useHomeTaskDetailsPrefetch(todayTasks: Task[], focusedTask: Task | null, olderTasks: Task[]) {
    useEffect(() => {
        let cancelled = false;
        const todayDetailTasks = [...new Map(
            [...todayTasks, ...(focusedTask ? [focusedTask] : [])].map(task => [task.taskId, task] as const),
        ).values()];
        const todayIds = new Set(todayDetailTasks.map(task => task.taskId));
        const olderDetailTasks = olderTasks.filter(task => !todayIds.has(task.taskId));

        const prefetchTasks = (tasks: Task[], workerCount: number) => {
            let nextTaskIndex = 0;
            const worker = async () => {
                while (!cancelled) {
                    const task = tasks[nextTaskIndex++];
                    if (!task) return;
                    try {
                        await taskService.getTaskDetails(task);
                    } catch (error) {
                        console.error('Error prefetching Home task details:', error);
                    }
                }
            };
            return Promise.all(Array.from({ length: Math.min(workerCount, tasks.length) }, () => worker()));
        };

        const olderWorkers = olderDetailTasks.length > 0 ? (todayDetailTasks.length > 0 ? 2 : MAX_CONCURRENT_REQUESTS) : 0;
        void Promise.all([
            prefetchTasks(todayDetailTasks, MAX_CONCURRENT_REQUESTS - olderWorkers),
            prefetchTasks(olderDetailTasks, olderWorkers),
        ]);

        return () => {
            cancelled = true;
        };
    }, [focusedTask, olderTasks, todayTasks]);
}
