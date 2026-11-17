import type { Task } from '../../types/Task';
import { taskDateKey } from './taskDate';

export function splitTasksByDate(tasks: Task[], displayDate: string) {
    return tasks.reduce((buckets, task) => {
        const scheduledDate = task.scheduledPerformDateTime
            ? taskDateKey(task.scheduledPerformDateTime)
            : '';
        if (!scheduledDate) buckets.undated.push(task);
        else if (scheduledDate === displayDate) buckets.today.push(task);
        else if (scheduledDate > displayDate) buckets.future.push(task);
        else buckets.past.push(task);
        return buckets;
    }, {
        today: [] as Task[],
        future: [] as Task[],
        past: [] as Task[],
        undated: [] as Task[],
    });
}
