import { orderHomeSchedule } from '../../services/utils/homeTaskOrdering';
import type { Task } from '../../types/Task';
import type { PendingHomeDateEdit } from './homeTypes';
import { isScheduledForHomeDay } from './homeTaskDates';

type HomeTodayInput = {
    allTasks: Task[];
    todayTasks: Task[];
    homeDayKey: string;
    dayEndHour: number;
    activeTaskId: string | null;
    resolvedActiveTask: Task | null;
};

/**
 * Today's main tasks for Home: the latest copy of every task scheduled for the Home day (see `isInHomeDay`), plus
 * the task with the running Pomodoro even when it belongs to another day.
 */
export function homeTodayTasks({
    allTasks, todayTasks, homeDayKey, dayEndHour, activeTaskId, resolvedActiveTask,
}: HomeTodayInput): Task[] {
    const inHomeDay = (task: Task) => isScheduledForHomeDay(task, homeDayKey, dayEndHour);
    const seenTaskIds = new Set<string>();
    const mergedTasks: Task[] = [];
    const taskById = new Map(allTasks.map(task => [task.taskId, task] as const));
    const addMainTask = (task: Task) => {
        const latestTask = taskById.get(task.taskId);
        const taskToAdd = latestTask ?? task;
        if (taskToAdd.parentId || seenTaskIds.has(taskToAdd.taskId)) return;
        if (latestTask && !inHomeDay(latestTask)
            && latestTask.taskId !== activeTaskId) return;
        seenTaskIds.add(task.taskId);
        mergedTasks.push(taskToAdd);
    };

    todayTasks.filter(inHomeDay).forEach(addMainTask);
    allTasks.forEach(task => {
        if (inHomeDay(task) || task.taskId === activeTaskId) addMainTask(task);
    });
    if (resolvedActiveTask?.taskId === activeTaskId) addMainTask(resolvedActiveTask);

    return orderHomeSchedule(mergedTasks);
}

type VisibleTasksInput = {
    todayTasks: Task[];
    allTasks: Task[];
    showCompleted: boolean;
    pendingDateTaskIds: string[];
    pendingDateEdits: ReadonlyMap<string, PendingHomeDateEdit>;
    pendingDeletedTaskIds: ReadonlySet<string>;
    activeTaskId: string | null;
};

/**
 * The rows Home lists under today. A task whose date is being edited away from today keeps
 * its original slot until the edit finishes, so the row does not jump while the picker is open.
 */
export function visibleHomeTasks({
    todayTasks,
    allTasks,
    showCompleted,
    pendingDateTaskIds,
    pendingDateEdits,
    pendingDeletedTaskIds,
    activeTaskId,
}: VisibleTasksInput): Task[] {
    const todayTaskIds = new Set(todayTasks.map(task => task.taskId));
    const originalIndex = (task: Task) => pendingDateEdits.get(task.taskId)?.originalIndex;
    const pendingDateTasks = pendingDateTaskIds
        .map(taskId => allTasks.find(task => task.taskId === taskId))
        .filter((task): task is Task => task !== undefined && !todayTaskIds.has(task.taskId))
        .sort((first, second) => (originalIndex(first) ?? Number.MAX_SAFE_INTEGER)
            - (originalIndex(second) ?? Number.MAX_SAFE_INTEGER));
    const tasksInOriginalOrder = [...todayTasks];
    pendingDateTasks.forEach(task => {
        const index = originalIndex(task) ?? tasksInOriginalOrder.length;
        tasksInOriginalOrder.splice(Math.min(index, tasksInOriginalOrder.length), 0, task);
    });
    return tasksInOriginalOrder
        .filter(task => !pendingDeletedTaskIds.has(task.taskId))
        .filter(task => !task.parentId && (showCompleted || !task.completed || task.taskId === activeTaskId));
}

/** Unfinished main tasks from before the Home day. */
export function olderHomeTasks(
    pastTasks: Task[],
    homeDayKey: string,
    dayEndHour: number,
    pendingDeletedTaskIds: ReadonlySet<string>,
): Task[] {
    return pastTasks.filter(task => !pendingDeletedTaskIds.has(task.taskId)
        && !task.parentId && !task.completed
        && !isScheduledForHomeDay(task, homeDayKey, dayEndHour));
}
