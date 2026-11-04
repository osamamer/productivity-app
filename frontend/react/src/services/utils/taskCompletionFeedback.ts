import type { Task } from '../../types/Task';

function isScheduledToday(task: Task, today: Date): boolean {
    if (!task.scheduledPerformDateTime || task.parentId || task.skipped) return false;
    const scheduled = new Date(task.scheduledPerformDateTime);
    return !Number.isNaN(scheduled.getTime())
        && scheduled.getFullYear() === today.getFullYear()
        && scheduled.getMonth() === today.getMonth()
        && scheduled.getDate() === today.getDate();
}

export function taskCompletionFeedbackKind(
    tasks: Task[],
    completingTaskIds: ReadonlySet<string>,
    today = new Date(),
): 'taskCompleted' | 'pomodoroCompleted' {
    const todayTasks = tasks.filter(task => isScheduledToday(task, today));
    const completesToday = todayTasks.some(task => !task.completed && completingTaskIds.has(task.taskId))
        && todayTasks.every(task => task.completed || completingTaskIds.has(task.taskId));
    return completesToday ? 'pomodoroCompleted' : 'taskCompleted';
}
