import { orderHomeSchedule } from '../../services/utils/homeTaskOrdering';
import type { Task } from '../../types/Task';
import type { PendingHomeDateEdit } from './homeTypes';
import { isScheduledForHomeDay } from './homeTaskDates';

type HomeTodayInput = {
    allTasks: Task[];
    todayTasks: Task[];
    homeDayKey: string;
    activeTaskId: string | null;
    resolvedActiveTask: Task | null;
};

/**
 * Today's main tasks for Home: the latest copy of every task scheduled for the Home day, plus
 * the task with the running Pomodoro even when it belongs to another day.
 */
export function homeTodayTasks({ allTasks, todayTasks, homeDayKey, activeTaskId, resolvedActiveTask }: HomeTodayInput): Task[] {
    const seenTaskIds = new Set<string>();
    const mergedTasks: Task[] = [];
    const taskById = new Map(allTasks.map(task => [task.taskId, task] as const));
    const addMainTask = (task: Task) => {
        const latestTask = taskById.get(task.taskId);
        const taskToAdd = latestTask ?? task;
        if (taskToAdd.parentId || seenTaskIds.has(taskToAdd.taskId)) return;
        if (latestTask && !isScheduledForHomeDay(latestTask, homeDayKey)
            && latestTask.taskId !== activeTaskId) return;
        seenTaskIds.add(task.taskId);
        mergedTasks.push(taskToAdd);
    };

    todayTasks.filter(task => isScheduledForHomeDay(task, homeDayKey)).forEach(addMainTask);
    allTasks.forEach(task => {
        if (isScheduledForHomeDay(task, homeDayKey) || task.taskId === activeTaskId) addMainTask(task);
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
export function olderHomeTasks(pastTasks: Task[], homeDayKey: string, pendingDeletedTaskIds: ReadonlySet<string>): Task[] {
    return pastTasks.filter(task => !pendingDeletedTaskIds.has(task.taskId)
        && !task.parentId && !task.completed
        && !isScheduledForHomeDay(task, homeDayKey));
}
