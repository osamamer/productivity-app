import { Project } from '../../types/Project';
import { Task } from '../../types/Task';

export function projectProgressPercent(project: Pick<Project, 'taskCount' | 'completedTaskCount'>): number {
    if (project.taskCount <= 0) return 0;
    return Math.min(100, Math.round((project.completedTaskCount / project.taskCount) * 100));
}

export function formatScheduledDate(dateTime: string | null): string {
    if (!dateTime) return 'No date';
    const date = new Date(dateTime);
    if (Number.isNaN(date.getTime())) return 'No date';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (taskDate.getTime() === today.getTime()) return 'Today';
    if (taskDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
    if (taskDate.getTime() === yesterday.getTime()) return 'Yesterday';

    const daysDiff = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (Math.abs(daysDiff) < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    if (date.getFullYear() !== now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface ProjectTaskSummary {
    openCount: number;
    overdueCount: number;
    nextDueTask: Task | null;
}

export function summarizeProjectTasks(tasks: readonly Task[], now = new Date()): ProjectTaskSummary {
    const openTasks = tasks.filter(task => !task.completed);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const datedOpenTasks = openTasks.flatMap(task => {
        if (!task.scheduledPerformDateTime) return [];
        const scheduledAt = new Date(task.scheduledPerformDateTime).getTime();
        return Number.isNaN(scheduledAt) ? [] : [{ task, scheduledAt }];
    });

    return {
        openCount: openTasks.length,
        overdueCount: datedOpenTasks.filter(({ scheduledAt }) => scheduledAt < todayStart).length,
        nextDueTask: datedOpenTasks
            .filter(({ scheduledAt }) => scheduledAt >= todayStart)
            .sort((first, second) => first.scheduledAt - second.scheduledAt)[0]?.task ?? null,
    };
}
