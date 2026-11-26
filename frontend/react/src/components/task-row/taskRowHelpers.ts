import { Task } from '../../types/Task';
import { PomodoroStatus } from '../../types/PomodoroStatus';

export function sortSubtasks(items: Task[]): Task[] {
    return [...items].sort((first, second) => {
        const firstCreated = Date.parse(first.creationDateTime);
        const secondCreated = Date.parse(second.creationDateTime);
        if (Number.isFinite(firstCreated) && Number.isFinite(secondCreated)
            && firstCreated !== secondCreated) {
            return firstCreated - secondCreated;
        }
        if (first.displayOrder !== second.displayOrder) {
            return first.displayOrder - second.displayOrder;
        }
        return first.taskId.localeCompare(second.taskId);
    });
}

export function checkboxColor(importance: number): string {
    if (importance > 7) return '#ef4444';
    if (importance > 4) return '#eab308';
    return '#1976d2';
}

export function formatSeconds(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(safeSeconds / 60);
    const s = safeSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFocusDuration(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
    return `${remainingSeconds}s`;
}

export function isWaitingForPhase(status: PomodoroStatus | null): boolean {
    return status?.phase === 'WAITING_FOR_BREAK' || status?.phase === 'WAITING_FOR_FOCUS';
}

export function isBreakPhase(status: PomodoroStatus): boolean {
    return status.phase
        ? status.phase === 'BREAK' || status.phase === 'WAITING_FOR_BREAK'
        : !status.sessionActive;
}

export const PRIORITY_OPTIONS = [
    { label: 'Low',    value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High',   value: 9, color: '#ef4444' },
];

export function currentPriorityLabel(importance: number): string {
    if (importance > 7) return 'High';
    if (importance > 4) return 'Medium';
    return 'Low';
}

export function formatScheduledDate(dateTime: string): string {
    const date = new Date(dateTime);
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

export function formatTaskDateTime(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function isEditableDragOrigin(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;

    const taskNameInput = target.closest('textarea[data-task-name-input="true"]');
    if (taskNameInput) return taskNameInput === document.activeElement;

    if (target.closest('[data-task-name="true"]')) return true;

    if (target.closest('[data-subtask-text="true"]')) return true;

    return target.closest(
        'input, textarea, select, button, [role="button"], .MuiButtonBase-root, [contenteditable="true"]',
    ) !== null;
}
