import type { Task } from '../../types/Task';
import { taskDateKey } from './taskDate';
import { isInHomeDay } from './homeDay';

/** Splits tasks around the Home day, whose tail runs into the next date until the day-end hour. */
export function splitTasksByDate(tasks: Task[], displayDate: string, dayEndHour = 0) {
    return tasks.reduce((buckets, task) => {
        const scheduledDate = task.scheduledPerformDateTime
            ? taskDateKey(task.scheduledPerformDateTime)
            : '';
        if (!scheduledDate) buckets.undated.push(task);
        else if (isInHomeDay(task.scheduledPerformDateTime, displayDate, dayEndHour)) buckets.today.push(task);
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
