import { Task } from '../../types/Task';
import { TaskGroup } from '../../types/TaskGroup';

export type ActiveExpansion = { taskId: string; panel: 'pomodoro' | 'details' } | null;
export type FocusVisibility = 'all' | 'fading' | 'sliding' | 'hidden' | 'revealing' | 'returning';
export type DropEdge = 'before' | 'after';
export type GroupDropIntent = DropEdge | 'inside';
export type GroupTaskDropPlacement = { targetTaskId: string; edge: DropEdge };
export type BulkAction = 'complete' | 'reopen' | 'move-to-today' | 'move-to-date' | 'clear-date';
export type { DeleteRequest, DeleteScope } from '../../services/utils/taskDeletionScope';
export type TaskContextMenuState = { task: Task; top: number; left: number; anchorEl: HTMLElement };
export type TaskReminderEditorState = { taskId: string; top: number; left: number };
export type TaskFeedback = {
    id: number;
    severity: 'success' | 'error';
    message: string;
    undo?: () => void | Promise<void>;
};
export type PendingUndo = {
    timeoutId: number;
    commit: () => void | Promise<void>;
};
export type PendingHomeDateEdit = {
    originalDateTime: string | null;
    latestDateTime: string | null;
    originalIndex: number;
};

export type HomeTaskListScope = 'today' | 'older';

export type TaskListItem =
    | { kind: 'task'; task: Task; renderKey: string }
    | { kind: 'group'; group: TaskGroup; tasks: Task[]; renderKey: string; expansionId: string };
export type SelectionEntity =
    | { kind: 'task'; id: string }
    | { kind: 'group'; id: string };
export type EditRequest = { taskId: string; requestId: number };
export type ActiveDrag =
    | { kind: 'tasks'; taskIds: string[]; primaryTaskId: string; preservedGroupIds: string[] }
    | { kind: 'group'; groupId: string };
export type TodayDropPlacement =
    | { kind: 'task'; targetTaskId: string; edge: DropEdge }
    | { kind: 'group'; targetGroup: TaskGroup; edge: DropEdge }
    | { kind: 'edge'; edge: 'top' | 'bottom' };
