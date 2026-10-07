import { Project } from '../../types/Project';

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
