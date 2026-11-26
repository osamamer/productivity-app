import { Task } from '../../types/Task';
import { TaskToCreate } from '../../types/TaskToCreate';
import { taskDateKey } from '../../services/utils/taskDate';

export function formatLocalDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function isSameLocalDay(first: Date, second: Date): boolean {
    return first.getFullYear() === second.getFullYear()
        && first.getMonth() === second.getMonth()
        && first.getDate() === second.getDate();
}

export function formatTaskDateForFeedback(value: string): string {
    const date = new Date(value);
    const now = new Date();
    if (Number.isNaN(date.getTime())) return 'a new date';
    if (isSameLocalDay(date, now)) return 'Today';
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    });
}

export function isScheduledForHomeDay(task: Task, homeDayKey: string): boolean {
    return task.scheduledPerformDateTime !== null
        && task.scheduledPerformDateTime !== undefined
        && taskDateKey(task.scheduledPerformDateTime) === homeDayKey;
}

export function moveTaskDateToHomeDay(task: Task, homeDay: Date): string {
    const today = new Date();
    const scheduledDate = task.scheduledPerformDateTime
        ? new Date(task.scheduledPerformDateTime)
        : today;
    const nextDate = Number.isNaN(scheduledDate.getTime()) ? today : scheduledDate;
    nextDate.setFullYear(homeDay.getFullYear(), homeDay.getMonth(), homeDay.getDate());
    return formatLocalDateTime(nextDate);
}

export function reorderTaskSnapshot(tasks: Task[], orderedTaskIds: string[]): Task[] {
    const taskIdSet = new Set(orderedTaskIds);
    const orderedTasks = tasks.filter(task => taskIdSet.has(task.taskId));
    const taskById = new Map(orderedTasks.map(task => [task.taskId, task]));
    let nextOrderedTask = 0;
    return tasks.map(task => {
        if (!taskIdSet.has(task.taskId)) return task;
        const orderedTask = taskById.get(orderedTaskIds[nextOrderedTask]);
        nextOrderedTask += 1;
        return orderedTask ?? task;
    });
}

export function createOptimisticTask(taskToCreate: TaskToCreate): Task {
    const now = new Date();
    const createdAt = formatLocalDateTime(now);

    return {
        taskId: `optimistic-task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: taskToCreate.name,
        description: taskToCreate.description,
        completed: false,
        creationDateTime: createdAt,
        creationDate: createdAt.slice(0, 10),
        scheduledPerformDateTime: taskToCreate.scheduledPerformDateTime || null,
        timeZone: taskToCreate.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        reminderMinutesBefore: taskToCreate.reminderMinutesBefore,
        completionDateTime: '',
        parentId: taskToCreate.parentId ?? '',
        tag: taskToCreate.tag,
        importance: taskToCreate.importance,
        displayOrder: 0,
        mentalThreadId: taskToCreate.mentalThreadId ?? null,
        projectId: taskToCreate.projectId ?? null,
        taskSeriesId: null,
        seriesOccurrenceAt: null,
        skipped: false,
    };
}
