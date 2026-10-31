import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    ButtonBase,
    CircularProgress,
    Collapse,
    Alert,
    Fade,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Popover,
    Portal,
    Slide,
    Snackbar,
    TextField,
    Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import { alpha } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { mergeTaskDeletionReceipts, taskGroupService, taskService } from '../services/api';
import type { TaskDeletionReceipt } from '../services/api';
import { invalidateResource } from '../services/cache/resourceInvalidation';
import { setCachedTaskDetails } from '../services/cache/taskDetailsCache';
import { Task } from '../types/Task';
import { TaskGroup } from '../types/TaskGroup';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../hooks/useGlobalTasks';
import { useUser } from '../hooks/useUser';
import { SmartTaskInput } from '../components/input/SmartTaskInput';
import { GroupTaskInputRow } from '../components/task/GroupTaskInputRow';
import { TaskParentPopover } from '../components/task/TaskParentPopover';
import { FlatTaskRow } from '../components/FlatTaskRow';
import { TaskToCreate } from '../types/TaskToCreate';
import {
    getExcludeTodayCompletedHomeTasks,
    getShowCompletedHomeTasks,
} from '../services/utils/homePreferences';
import { getAuthCacheScope } from '../services/utils/authHeaders';
import { PomodoroStatus } from '../types/PomodoroStatus';
import { celebrateStatLogged } from '../services/statCelebration';
import { playAudioFeedback } from '../services/audioFeedback';
import { BulkTaskDatePopover } from '../components/task/BulkTaskDatePopover';
import { findKeyboardDeleteAnchor, useKeyboardDelete } from '../hooks/useKeyboardDelete';
import { TaskReminderPicker } from '../components/task/TaskReminderPicker';
import { usePomodoro } from '../hooks/usePomodoro';
import { TodayEventsSection } from '../components/home/TodayEventsSection';

type ActiveExpansion = { taskId: string; panel: 'pomodoro' | 'details' } | null;
type FocusVisibility = 'all' | 'fading' | 'sliding' | 'hidden' | 'revealing' | 'returning';
type DropEdge = 'before' | 'after';
type GroupDropIntent = DropEdge | 'inside';
type GroupTaskDropPlacement = { targetTaskId: string; edge: DropEdge };
type BulkAction = 'complete' | 'reopen' | 'move-to-today' | 'move-to-date' | 'clear-date';
type DeleteRequest =
    | { kind: 'single' | 'bulk'; tasks: Task[]; anchorEl: HTMLElement }
    | { kind: 'group'; group: TaskGroup; tasks: Task[]; anchorEl: HTMLElement };
type DeleteScope = 'occurrence' | 'future' | 'series';
type TaskContextMenuState = { task: Task; top: number; left: number; anchorEl: HTMLElement };
type TaskReminderEditorState = { taskId: string; top: number; left: number };
type TaskFeedback = {
    id: number;
    severity: 'success' | 'error';
    message: string;
    undo?: () => void | Promise<void>;
};
type PendingUndo = {
    timeoutId: number;
    commit: () => void | Promise<void>;
};
type PendingHomeDateEdit = {
    originalDateTime: string | null;
    latestDateTime: string | null;
    originalIndex: number;
};

type HomeTaskListScope = 'today' | 'older';

type TaskListItem =
    | { kind: 'task'; task: Task; renderKey: string }
    | { kind: 'group'; group: TaskGroup; tasks: Task[]; renderKey: string; expansionId: string };
type SelectionEntity =
    | { kind: 'task'; id: string }
    | { kind: 'group'; id: string };
type EditRequest = { taskId: string; requestId: number };
type ActiveDrag =
    | { kind: 'tasks'; taskIds: string[]; primaryTaskId: string; preservedGroupIds: string[] }
    | { kind: 'group'; groupId: string };
type TodayDropPlacement =
    | { kind: 'task'; targetTaskId: string; edge: DropEdge }
    | { kind: 'group'; targetGroup: TaskGroup; edge: DropEdge }
    | { kind: 'edge'; edge: 'top' | 'bottom' };

function groupExpansionId(group: TaskGroup, scope: HomeTaskListScope): string {
    return group.isStatGroup ? `stat-group:${scope}:${group.groupId}` : group.groupId;
}

function collapsedHomeGroupIds(groups: TaskGroup[]): Set<string> {
    return new Set(groups.flatMap(group => group.isStatGroup
        ? [groupExpansionId(group, 'today'), groupExpansionId(group, 'older')]
        : [group.groupId]));
}

function reconcileCollapsedHomeGroupIds(
    previousCollapsed: Set<string>,
    previousGroups: TaskGroup[],
    nextGroups: TaskGroup[],
): Set<string> {
    const knownExpansionIds = new Set(previousGroups.flatMap(group => group.isStatGroup
        ? [groupExpansionId(group, 'today'), groupExpansionId(group, 'older')]
        : [group.groupId]));
    const nextCollapsed = new Set<string>();

    nextGroups.forEach(group => {
        const expansionIds = group.isStatGroup
            ? [groupExpansionId(group, 'today'), groupExpansionId(group, 'older')]
            : [group.groupId];
        expansionIds.forEach(expansionId => {
            if (!knownExpansionIds.has(expansionId) || previousCollapsed.has(expansionId)) {
                nextCollapsed.add(expansionId);
            }
        });
    });

    return nextCollapsed;
}

function requestHasRecurringTasks(request: DeleteRequest): boolean {
    return request.tasks.some(task => Boolean(task.taskSeriesId));
}

function tasksForDeleteScope(request: DeleteRequest, scope: DeleteScope, allTasks: Task[]): Task[] {
    if (scope === 'occurrence') return request.tasks;

    const selectedTaskIds = new Set(request.tasks.map(task => task.taskId));
    const selectedSeriesIds = new Set(
        request.tasks
            .map(task => task.taskSeriesId)
            .filter((seriesId): seriesId is string => Boolean(seriesId)),
    );
    const affectedTasks = new Map<string, Task>();
    if (scope === 'future') {
        const boundaryBySeries = new Map<string, string>();
        request.tasks.forEach(task => {
            if (!task.taskSeriesId) return;
            const boundary = task.seriesOccurrenceAt ?? task.scheduledPerformDateTime;
            if (!boundary) return;
            const existing = boundaryBySeries.get(task.taskSeriesId);
            if (!existing || boundary < existing) boundaryBySeries.set(task.taskSeriesId, boundary);
        });
        [...request.tasks, ...allTasks].forEach(task => {
            if (!task.taskSeriesId) {
                if (selectedTaskIds.has(task.taskId)) affectedTasks.set(task.taskId, task);
                return;
            }
            const boundary = boundaryBySeries.get(task.taskSeriesId);
            const occurrenceAt = task.seriesOccurrenceAt ?? task.scheduledPerformDateTime;
            if (boundary && occurrenceAt && occurrenceAt > boundary) affectedTasks.set(task.taskId, task);
        });
        return [...affectedTasks.values()];
    }

    request.tasks.forEach(task => affectedTasks.set(task.taskId, task));
    allTasks.forEach(task => {
        if (selectedSeriesIds.has(task.taskSeriesId ?? '')) affectedTasks.set(task.taskId, task);
    });

    return [...affectedTasks.values()].filter(task => (
        selectedTaskIds.has(task.taskId) || selectedSeriesIds.has(task.taskSeriesId ?? '')
    ));
}

async function deleteTasksForScope(tasks: Task[], scope: DeleteScope): Promise<TaskDeletionReceipt | null> {
    const deletedSeriesIds = new Set<string>();
    const options = { notifyResource: false };
    const operations = tasks.flatMap(task => {
        if ((scope === 'series' || scope === 'future') && task.taskSeriesId) {
            if (deletedSeriesIds.has(task.taskSeriesId)) return [];
            deletedSeriesIds.add(task.taskSeriesId);
            const seriesTasks = tasks.filter(candidate => candidate.taskSeriesId === task.taskSeriesId);
            const boundaryTask = seriesTasks.sort((first, second) => (
                (first.seriesOccurrenceAt ?? first.scheduledPerformDateTime ?? '')
                    .localeCompare(second.seriesOccurrenceAt ?? second.scheduledPerformDateTime ?? '')
            ))[0] ?? task;
            return [() => scope === 'future'
                ? taskService.deleteTaskFutureOccurrences(boundaryTask.taskId, options)
                : taskService.deleteTask(task.taskId, options)];
        }

        return [() => scope === 'occurrence'
            ? taskService.deleteTaskInstance(task, options)
            : taskService.deleteTask(task.taskId, options)];
    });
    const receipts: Array<TaskDeletionReceipt | null> = [];
    try {
        for (const operation of operations) receipts.push(await operation());
    } catch (error) {
        const restorableReceipts = receipts.filter(
            (receipt): receipt is TaskDeletionReceipt => receipt !== null,
        );
        if (restorableReceipts.length > 0) {
            try {
                const restorableReceipt = mergeTaskDeletionReceipts(restorableReceipts);
                if (restorableReceipt) {
                    await taskService.restoreTaskDeletion(restorableReceipt, { notifyResource: false });
                }
            } catch (restoreError) {
                console.error('Could not roll back the completed part of a task deletion:', restoreError);
            }
        }
        throw error;
    }
    return mergeTaskDeletionReceipts(receipts);
}

const HOME_ACTIVE_EXPANSION_STORAGE_KEY = 'home-active-expansion';

function homeActiveExpansionStorageKey(): string {
    return `claritard:${getAuthCacheScope()}:${HOME_ACTIVE_EXPANSION_STORAGE_KEY}`;
}

function readHomeActiveExpansion(): ActiveExpansion {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(homeActiveExpansionStorageKey());
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<NonNullable<ActiveExpansion>>;
        if (typeof parsed.taskId !== 'string'
            || parsed.taskId.length === 0
            || (parsed.panel !== 'pomodoro' && parsed.panel !== 'details')) {
            return null;
        }
        return { taskId: parsed.taskId, panel: parsed.panel };
    } catch (error) {
        console.warn('Could not restore the expanded Home task:', error);
        return null;
    }
}

const greetingReveal = keyframes`
    from {
        opacity: 0;
        transform: translateX(-32px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
`;

const focusTaskSlide = keyframes`
    from {
        opacity: 0;
        transform: translateY(var(--focus-task-offset, 0px));
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

const focusTaskReturn = keyframes`
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(var(--focus-task-offset, 0px));
    }
`;

const tasksFadeAway = keyframes`
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
    }
`;

const tasksFadeBack = keyframes`
    from {
        opacity: 0;
        transform: translateY(7px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

const buttonFadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

const TASKS_FADE_DURATION_MS = 220;
const FOCUS_TASK_SLIDE_DURATION_MS = 520;
const SELECTION_ACTIONS_EDGE_PADDING = 12;
const SELECTION_ACTIONS_GAP = 4;
const SELECTION_ACTIONS_FALLBACK_WIDTH = 136;

const SlideFromRight = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof Slide>>(
    (props, ref) => <Slide {...props} ref={ref} direction="left" />,
);
SlideFromRight.displayName = 'SlideFromRight';

let hasAnimatedHomeGreeting = false;

function buildTaskListItems(
    tasks: Task[],
    groups: TaskGroup[],
    getTaskRenderKey: (taskId: string) => string,
    scope: HomeTaskListScope,
    anchorTasks: Task[] = tasks,
): TaskListItem[] {
    const visibleTaskIds = new Set(tasks.map(task => task.taskId));
    const anchorIndexByTaskId = new Map(anchorTasks.map((task, index) => [task.taskId, index] as const));
    const groupByTaskId = new Map<string, TaskGroup>();
    const tasksByGroupId = new Map<string, Task[]>();

    groups
        .sort((first, second) => first.displayOrder - second.displayOrder)
        .forEach(group => group.taskIds.forEach(taskId => {
            if (visibleTaskIds.has(taskId) && !groupByTaskId.has(taskId)) {
                groupByTaskId.set(taskId, group);
            }
        }));

    tasks.forEach(task => {
        const groupId = groupByTaskId.get(task.taskId)?.groupId;
        if (!groupId) return;
        const groupTasks = tasksByGroupId.get(groupId);
        if (groupTasks) groupTasks.push(task);
        else tasksByGroupId.set(groupId, [task]);
    });

    const emittedGroupIds = new Set<string>();
    const items: TaskListItem[] = [];

    tasks.forEach(task => {
        const group = groupByTaskId.get(task.taskId);
        if (!group) {
            items.push({
                kind: 'task',
                task,
                renderKey: getTaskRenderKey(task.taskId),
            });
            return;
        }
        if (emittedGroupIds.has(group.groupId)) return;

        emittedGroupIds.add(group.groupId);
        const groupTasks = tasksByGroupId.get(group.groupId) ?? [];
        if ((group.linkedToMentalThread || group.isStatGroup) && groupTasks.length === 1) {
            const singletonTask = groupTasks[0];
            items.push({
                kind: 'task',
                task: singletonTask,
                renderKey: getTaskRenderKey(singletonTask.taskId),
            });
            return;
        }

        items.push({
            kind: 'group',
            group,
            tasks: groupTasks,
            renderKey: `group:${group.groupId}`,
            expansionId: groupExpansionId(group, scope),
        });
    });

    return items
        .map((item, index) => {
            const anchorIndex = item.kind === 'task'
                ? anchorIndexByTaskId.get(item.task.taskId)
                : item.group.taskIds
                    .map(taskId => anchorIndexByTaskId.get(taskId))
                    .filter((taskIndex): taskIndex is number => taskIndex !== undefined)
                    .reduce<number | undefined>(
                        (earliest, taskIndex) => earliest === undefined ? taskIndex : Math.min(earliest, taskIndex),
                        undefined,
                    );
            return { item, index, anchorIndex: anchorIndex ?? index };
        })
        .sort((first, second) => first.anchorIndex - second.anchorIndex || first.index - second.index)
        .map(({ item }) => item);
}

function buildCompletionGroupTaskIdsByTaskId(
    items: TaskListItem[],
    scopeTasks: Task[],
): Map<string, string[]> {
    const scopeTaskIds = new Set([
        ...scopeTasks.map(task => task.taskId),
        ...items.flatMap(item => item.kind === 'task'
            ? [item.task.taskId]
            : item.tasks.map(task => task.taskId)),
    ]);
    const groupTaskIdsByTaskId = new Map<string, string[]>();

    items.forEach(item => {
        if (item.kind !== 'group') return;

        const groupTaskIds = item.group.taskIds.filter(taskId => scopeTaskIds.has(taskId));
        if (groupTaskIds.length < 2) return;
        groupTaskIds.forEach(taskId => groupTaskIdsByTaskId.set(taskId, groupTaskIds));
    });

    return groupTaskIdsByTaskId;
}

function mergeCompletionGroupTaskIdsByTaskId(
    ...groupMaps: Map<string, string[]>[]
): Map<string, string[]> {
    const merged = new Map<string, string[]>();
    groupMaps.forEach(groupMap => groupMap.forEach((taskIds, taskId) => merged.set(taskId, taskIds)));
    return merged;
}

function taskListItemId(item: TaskListItem): string {
    return item.renderKey;
}

function taskListItemContainsTask(item: TaskListItem, taskIds: Set<string>): boolean {
    if (item.kind === 'task') return taskIds.has(item.task.taskId);
    return item.tasks.some(task => taskIds.has(task.taskId))
        || item.group.taskIds.some(taskId => taskIds.has(taskId));
}

function taskDropEdge(event: React.DragEvent<HTMLElement>): DropEdge {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
}

function dropIntent(event: React.DragEvent<HTMLElement>): GroupDropIntent {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    if (relativeY < 0.32) return 'before';
    if (relativeY > 0.68) return 'after';
    return 'inside';
}

function isDragOverTask(event: React.DragEvent<HTMLElement>): boolean {
    const target = event.target;
    return target instanceof Element && target.closest('[data-task-id]') !== null;
}

function groupTaskDropPlacement(
    event: React.DragEvent<HTMLElement>,
    group: TaskGroup,
): GroupTaskDropPlacement | null {
    const groupTaskIdSet = new Set(group.taskIds);
    const taskRows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-task-id]'))
        .filter(row => groupTaskIdSet.has(row.dataset.taskId ?? ''))
        .sort((first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top);
    if (taskRows.length === 0) return null;

    for (const taskRow of taskRows) {
        const bounds = taskRow.getBoundingClientRect();
        if (event.clientY < bounds.top + bounds.height / 2) {
            return { targetTaskId: taskRow.dataset.taskId!, edge: 'before' };
        }
    }

    return { targetTaskId: taskRows[taskRows.length - 1].dataset.taskId!, edge: 'after' };
}

type AnimatedTaskListProps = {
    items: TaskListItem[];
    renderItem: (item: TaskListItem) => React.ReactNode;
    onAnimatingChange?: (animating: boolean) => void;
    animateRemovals?: boolean;
    immediateRemovalTaskIds?: Set<string>;
    entrySource?: { taskId: string; top: number } | null;
    layoutVisibilityKey?: unknown;
    layoutScope: HomeTaskListScope;
    layoutSnapshotRef: React.MutableRefObject<HomeTaskLayoutSnapshot | null>;
};

type HomeTaskLayoutSnapshot = {
    itemRects: Map<string, DOMRect>;
    taskRectsById: Map<string, DOMRect>;
    completionChange: boolean;
};

const TASK_EXIT_DURATION_MS = 360;
const TASK_REORDER_DURATION_MS = 340;
const TASK_COMPLETION_REORDER_DURATION_MS = 440;
const TASK_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const TASK_COMPLETION_REORDER_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const EDGE_DROP_ZONE_OUTSIDE_REACH = 72;
const EDGE_DROP_ZONE_LIST_OVERLAP = 16;

type AnimatedGroupTaskRowsProps = {
    tasks: Task[];
    renderTask: (task: Task) => React.ReactNode;
};

function AnimatedGroupTaskRows({ tasks, renderTask }: AnimatedGroupTaskRowsProps) {
    const [exitingTasks, setExitingTasks] = useState<Array<{ task: Task; index: number }>>([]);
    const previousTasksRef = useRef(tasks);
    const exitingTasksRef = useRef<Array<{ task: Task; index: number }>>([]);
    const currentTaskIdsRef = useRef(new Set(tasks.map(task => task.taskId)));

    useLayoutEffect(() => {
        const nextTaskIds = new Set(tasks.map(task => task.taskId));
        const previousTasks = previousTasksRef.current;
        const nextExitingTasks = exitingTasksRef.current.filter(({ task }) => !nextTaskIds.has(task.taskId));
        previousTasks.forEach((task, index) => {
            if (!nextTaskIds.has(task.taskId)
                && !nextExitingTasks.some(exiting => exiting.task.taskId === task.taskId)) {
                nextExitingTasks.push({ task, index });
            }
        });

        const exitingChanged = nextExitingTasks.length !== exitingTasksRef.current.length
            || nextExitingTasks.some((exiting, index) => {
                const previous = exitingTasksRef.current[index];
                return !previous || previous.task.taskId !== exiting.task.taskId || previous.index !== exiting.index;
            });
        exitingTasksRef.current = nextExitingTasks;
        previousTasksRef.current = tasks;
        currentTaskIdsRef.current = nextTaskIds;
        if (exitingChanged) setExitingTasks(nextExitingTasks);
    }, [tasks]);

    const currentTaskIdSet = new Set(tasks.map(task => task.taskId));
    const displayedRows = tasks.map(task => ({ task, exiting: false }));
    [...exitingTasks]
        .filter(({ task }) => !currentTaskIdSet.has(task.taskId))
        .sort((first, second) => first.index - second.index)
        .forEach(({ task, index }) => {
            displayedRows.splice(Math.min(index, displayedRows.length), 0, { task, exiting: true });
        });

    return displayedRows.map(({ task, exiting }) => (
        <Collapse
            key={task.taskId}
            in={!exiting}
            timeout={TASK_EXIT_DURATION_MS}
            unmountOnExit
            onExited={() => {
                if (currentTaskIdsRef.current.has(task.taskId)) return;
                const remainingTasks = exitingTasksRef.current.filter(item => item.task.taskId !== task.taskId);
                exitingTasksRef.current = remainingTasks;
                setExitingTasks(remainingTasks);
            }}
        >
            <Box data-task-exiting={exiting ? 'true' : undefined}>
                {renderTask(task)}
            </Box>
        </Collapse>
    ));
}

function AnimatedTaskList({
    items,
    renderItem,
    onAnimatingChange,
    animateRemovals = true,
    immediateRemovalTaskIds,
    entrySource = null,
    layoutVisibilityKey,
    layoutScope,
    layoutSnapshotRef,
}: AnimatedTaskListProps) {
    const [displayedItems, setDisplayedItems] = useState(items);
    const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(() => new Set());
    const displayedItemsRef = useRef(items);
    const currentItemIdsRef = useRef(new Set(items.map(taskListItemId)));
    const exitingItemIdsRef = useRef(new Set<string>());
    const itemElementsRef = useRef(new Map<string, HTMLDivElement>());
    const previousItemRectsRef = useRef(new Map<string, DOMRect>());
    const previousGroupTaskRectsRef = useRef(new Map<string, Map<string, DOMRect>>());
    const previousTaskRectsByIdRef = useRef(new Map<string, DOMRect>());
    const previousLayoutRef = useRef<{
        itemIds: string[];
        groupTaskIds: Map<string, string[]>;
        taskCompletionById: Map<string, boolean>;
        taskOwnerById: Map<string, string>;
    } | null>(null);
    const previousLayoutSignatureRef = useRef<string | null>(null);
    const animationTimersRef = useRef(new Map<string, number>());

    useLayoutEffect(() => {
        if (!animateRemovals) {
            exitingItemIdsRef.current.clear();
            currentItemIdsRef.current = new Set(items.map(taskListItemId));
            displayedItemsRef.current = items;
            setDisplayedItems(items);
            setExitingItemIds(new Set());
            onAnimatingChange?.(false);
            return;
        }

        const nextItemIdsInOrder = items.map(taskListItemId);
        const nextItemIds = new Set(nextItemIdsInOrder);
        const previousItems = displayedItemsRef.current;
        const previousItemIds = previousItems.map(taskListItemId);
        const sameDisplayedItems = exitingItemIdsRef.current.size === 0
            && previousItemIds.length === nextItemIdsInOrder.length
            && previousItemIds.every((itemId, index) => itemId === nextItemIdsInOrder[index]);

        // A server response can replace the optimistic task payload without
        // changing the list's layout identity. Reconcile that payload in place
        // so the completed entrance transition is not treated as a second add.
        if (sameDisplayedItems) {
            currentItemIdsRef.current = nextItemIds;
            displayedItemsRef.current = items;
            setDisplayedItems(previous => previous === items ? previous : items);
            return;
        }
        const removedItems = previousItems.filter(item => !nextItemIds.has(taskListItemId(item)));
        const immediateRemovalItemIds = new Set(
            removedItems
                .filter(item => immediateRemovalTaskIds && taskListItemContainsTask(item, immediateRemovalTaskIds))
                .map(taskListItemId),
        );
        immediateRemovalItemIds.forEach(itemId => {
            exitingItemIdsRef.current.delete(itemId);
        });
        const reappearedItemIds = items
            .map(taskListItemId)
            .filter(itemId => exitingItemIdsRef.current.has(itemId));

        currentItemIdsRef.current = nextItemIds;
        reappearedItemIds.forEach(itemId => {
            exitingItemIdsRef.current.delete(itemId);
        });
        if (reappearedItemIds.length > 0) {
            setExitingItemIds(new Set(exitingItemIdsRef.current));
            if (exitingItemIdsRef.current.size === 0) onAnimatingChange?.(false);
        }

        // Follow the source order so newly created or reordered tasks appear
        // where the task state puts them. Removed rows are inserted back at
        // their previous slot only while their exit transition is running.
        const animatedRemovedItems = removedItems.filter(
            item => !immediateRemovalItemIds.has(taskListItemId(item)),
        );
        const mergedItems = [...items];
        animatedRemovedItems.forEach(item => {
            const previousIndex = previousItems.findIndex(
                previousItem => taskListItemId(previousItem) === taskListItemId(item),
            );
            mergedItems.splice(Math.min(previousIndex, mergedItems.length), 0, item);
        });
        displayedItemsRef.current = mergedItems;
        if (mergedItems.length !== previousItems.length
            || mergedItems.some((item, index) => item !== previousItems[index])) {
            setDisplayedItems(mergedItems);
        }

        if (immediateRemovalItemIds.size > 0) {
            setExitingItemIds(new Set(exitingItemIdsRef.current));
            if (exitingItemIdsRef.current.size === 0) onAnimatingChange?.(false);
        }

        const newlyRemovedItems = animatedRemovedItems.filter(item => !exitingItemIdsRef.current.has(taskListItemId(item)));
        if (newlyRemovedItems.length > 0) {
            newlyRemovedItems.forEach(item => exitingItemIdsRef.current.add(taskListItemId(item)));
            setExitingItemIds(new Set(exitingItemIdsRef.current));
            onAnimatingChange?.(true);
        }
    }, [animateRemovals, immediateRemovalTaskIds, items, onAnimatingChange]);

    const renderedItems = animateRemovals ? displayedItems : items;
    const layoutSignature = useMemo(
        // Ignore response-only changes so they cannot replay a completed row move.
        () => JSON.stringify(renderedItems.map(item => item.kind === 'task'
            ? [item.renderKey, item.task.taskId, item.task.name, item.task.completed, item.task.tag,
                item.task.scheduledPerformDateTime, item.task.importance]
            : [item.renderKey, item.group.name, item.tasks.map(task => [task.taskId, task.name,
                task.completed, task.tag, task.scheduledPerformDateTime, task.importance])])),
        [renderedItems],
    );

    useLayoutEffect(() => {
        const measureTaskRects = () => {
            const groupTaskRects = new Map<string, Map<string, DOMRect>>();
            const taskRectsById = new Map<string, DOMRect>();
            renderedItems.forEach(item => {
                const itemElement = itemElementsRef.current.get(taskListItemId(item));
                if (!itemElement) return;

                const taskRects = new Map<string, DOMRect>();
                itemElement.querySelectorAll<HTMLElement>('[data-task-id]').forEach(taskElement => {
                    if (taskElement.closest('[data-task-exiting="true"]')) return;
                    const taskId = taskElement.dataset.taskId;
                    if (!taskId) return;
                    const rect = taskElement.getBoundingClientRect();
                    taskRects.set(taskId, rect);
                    taskRectsById.set(taskId, rect);
                });
                if (item.kind === 'group') groupTaskRects.set(item.renderKey, taskRects);
            });
            return { groupTaskRects, taskRectsById };
        };

        const signatureChanged = previousLayoutSignatureRef.current !== layoutSignature;
        if (!signatureChanged) {
            if (animationTimersRef.current.size > 0) return;

            const currentItemRects = new Map<string, DOMRect>();
            renderedItems.forEach(item => {
                const itemId = taskListItemId(item);
                const itemElement = itemElementsRef.current.get(itemId);
                if (!itemElement) return;

                currentItemRects.set(itemId, itemElement.getBoundingClientRect());
            });
            previousItemRectsRef.current = currentItemRects;
            const measuredGroupTaskRects = measureTaskRects();
            previousGroupTaskRectsRef.current = measuredGroupTaskRects.groupTaskRects;
            previousTaskRectsByIdRef.current = measuredGroupTaskRects.taskRectsById;
            return;
        }
        previousLayoutSignatureRef.current = layoutSignature;
        const nextItemIds = renderedItems.map(taskListItemId);
        const nextGroupTaskIds = new Map<string, string[]>(renderedItems
            .filter((item): item is Extract<TaskListItem, { kind: 'group' }> => item.kind === 'group')
            .map(item => [item.renderKey, item.tasks.map(task => task.taskId)] as const));
        const nextTaskCompletionById = new Map<string, boolean>();
        const nextTaskOwnerById = new Map<string, string>();
        renderedItems.forEach(item => {
            if (item.kind === 'task') {
                nextTaskCompletionById.set(item.task.taskId, item.task.completed);
                nextTaskOwnerById.set(item.task.taskId, taskListItemId(item));
            } else {
                item.tasks.forEach(task => {
                    nextTaskCompletionById.set(task.taskId, task.completed);
                    nextTaskOwnerById.set(task.taskId, item.renderKey);
                });
            }
        });
        const previousLayout = previousLayoutRef.current;
        const layoutSnapshot = layoutSnapshotRef.current;
        const completionStatusChanged = layoutSnapshot?.completionChange === true
            || (previousLayout !== null && Array.from(nextTaskCompletionById).some(([taskId, completed]) => (
                previousLayout.taskCompletionById.has(taskId)
                && previousLayout.taskCompletionById.get(taskId) !== completed
            )));
        const layoutAnimationDuration = completionStatusChanged
            ? TASK_COMPLETION_REORDER_DURATION_MS
            : TASK_REORDER_DURATION_MS;
        const layoutAnimationEasing = completionStatusChanged
            ? TASK_COMPLETION_REORDER_EASING
            : TASK_REORDER_EASING;
        const previousItemIdSet = new Set(previousLayout?.itemIds ?? []);
        const nextItemIdSet = new Set(nextItemIds);
        const sameItemSet = previousLayout !== null
            && previousLayout.itemIds.length === nextItemIds.length
            && nextItemIds.every(itemId => previousItemIdSet.has(itemId));
        const sameItemOrder = previousLayout !== null
            && sameItemSet
            && previousLayout.itemIds.every((itemId, index) => itemId === nextItemIds[index]);
        const onlyItemAdditions = previousLayout !== null
            && nextItemIds.length > previousLayout.itemIds.length
            && previousLayout.itemIds.every(itemId => nextItemIdSet.has(itemId));
        const nextItemRects = new Map<string, DOMRect>();
        const nextGroupTaskRects = new Map<string, Map<string, DOMRect>>();
        const nextTaskRectsById = new Map<string, DOMRect>();

        const animateElement = (
            key: string,
            element: HTMLElement,
            previousRect: DOMRect,
            nextRect: DOMRect,
            duration = layoutAnimationDuration,
            easing = layoutAnimationEasing,
        ) => {
            const deltaX = previousRect.left - nextRect.left;
            const deltaY = previousRect.top - nextRect.top;
            if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

            const previousTimer = animationTimersRef.current.get(key);
            if (previousTimer !== undefined) window.clearTimeout(previousTimer);
            element.style.transition = 'none';
            element.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
            element.dataset.homeFlipActive = 'true';
            void element.offsetHeight;
            element.style.transition = `transform ${duration}ms ${easing}`;
            element.style.transform = 'translate3d(0, 0, 0)';
            const timer = window.setTimeout(() => {
                element.style.transition = '';
                element.style.transform = '';
                delete element.dataset.homeFlipActive;
                animationTimersRef.current.delete(key);
            }, duration);
            animationTimersRef.current.set(key, timer);
        };

        const animateEntry = (
            key: string,
            element: HTMLElement,
            sourceTop: number | null = null,
            duration = layoutAnimationDuration,
            easing = layoutAnimationEasing,
        ) => {
            const previousTimer = animationTimersRef.current.get(key);
            if (previousTimer !== undefined) window.clearTimeout(previousTimer);
            const offsetY = sourceTop === null
                ? -6
                : sourceTop - element.getBoundingClientRect().top - window.scrollY;
            element.style.transition = 'none';
            element.style.opacity = sourceTop === null ? '0' : '1';
            element.style.transform = `translate3d(0, ${offsetY}px, 0)`;
            element.dataset.homeFlipActive = 'true';
            void element.offsetHeight;
            element.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ${easing}`;
            element.style.opacity = '1';
            element.style.transform = 'translate3d(0, 0, 0)';
            const timer = window.setTimeout(() => {
                element.style.transition = '';
                element.style.opacity = '';
                element.style.transform = '';
                delete element.dataset.homeFlipActive;
                animationTimersRef.current.delete(key);
            }, duration);
            animationTimersRef.current.set(key, timer);
        };

        renderedItems.forEach(item => {
            const itemId = taskListItemId(item);
            const itemElement = itemElementsRef.current.get(itemId);
            if (!itemElement) return;

            const itemRect = itemElement.getBoundingClientRect();
            nextItemRects.set(itemId, itemRect);
            const previousItemRect = layoutSnapshot?.itemRects.get(itemId)
                ?? previousItemRectsRef.current.get(itemId);
            const itemOrderChanged = sameItemSet && !sameItemOrder;
            if (itemOrderChanged || onlyItemAdditions) {
                if (previousItemRect) animateElement(`item:${itemId}`, itemElement, previousItemRect, itemRect);
                else if (onlyItemAdditions) {
                    const containsReturnTask = item.kind === 'group'
                        && item.tasks.some(task => task.taskId === entrySource?.taskId);
                    if (!containsReturnTask) {
                        const sourceTop = item.kind === 'task' && entrySource?.taskId === item.task.taskId
                            ? entrySource.top
                            : null;
                        animateEntry(`item:${itemId}`, itemElement, sourceTop);
                    }
                }
            }

            if (item.kind === 'task') {
                const taskElement = itemElement.querySelector<HTMLElement>('[data-task-id]');
                const previousOwner = previousLayout?.taskOwnerById.get(item.task.taskId);
                const previousTaskRect = layoutSnapshot?.taskRectsById.get(item.task.taskId)
                    ?? previousTaskRectsByIdRef.current.get(item.task.taskId);
                if (taskElement) {
                    const taskRect = taskElement.getBoundingClientRect();
                    nextTaskRectsById.set(item.task.taskId, taskRect);
                    if (previousOwner && previousOwner !== itemId && previousTaskRect) {
                        animateElement(`task:${item.task.taskId}`, taskElement, previousTaskRect, taskRect);
                    }
                }
                return;
            }

            const groupTaskRects = new Map<string, DOMRect>();
            const previousGroupTaskIds = previousLayout?.groupTaskIds.get(itemId) ?? [];
            const nextGroupTaskIdsForItem = nextGroupTaskIds.get(itemId) ?? [];
            const nextGroupTaskIdSet = new Set(nextGroupTaskIdsForItem);
            const groupTaskOrderChanged = previousGroupTaskIds.length === nextGroupTaskIdsForItem.length
                && previousGroupTaskIds.some((taskId, index) => taskId !== nextGroupTaskIdsForItem[index]);
            const onlyGroupTaskAdditions = previousGroupTaskIds.length > 0
                && nextGroupTaskIdsForItem.length > previousGroupTaskIds.length
                && previousGroupTaskIds.every(taskId => nextGroupTaskIdSet.has(taskId));
            const previousGroupTaskIdSet = new Set(previousGroupTaskIds);
            const onlyGroupTaskRemovals = nextGroupTaskIdsForItem.length > 0
                && nextGroupTaskIdsForItem.length < previousGroupTaskIds.length
                && nextGroupTaskIdsForItem.every(taskId => previousGroupTaskIdSet.has(taskId));
            const groupTaskLayoutChanged = groupTaskOrderChanged || onlyGroupTaskAdditions || onlyGroupTaskRemovals;
            const groupMoved = previousItemRect !== undefined
                && (Math.abs(previousItemRect.left - itemRect.left) >= 1
                    || Math.abs(previousItemRect.top - itemRect.top) >= 1);
            const previousGroupTaskRects = previousGroupTaskRectsRef.current.get(itemId);
            const groupCompletionChanged = nextGroupTaskIdsForItem.some(taskId => (
                previousLayout?.taskCompletionById.has(taskId)
                && previousLayout.taskCompletionById.get(taskId) !== nextTaskCompletionById.get(taskId)
            ));
            const taskAnimationDuration = groupCompletionChanged
                ? TASK_COMPLETION_REORDER_DURATION_MS
                : TASK_REORDER_DURATION_MS;
            const taskAnimationEasing = groupCompletionChanged
                ? TASK_COMPLETION_REORDER_EASING
                : TASK_REORDER_EASING;

            itemElement.querySelectorAll<HTMLElement>('[data-task-id]').forEach(taskElement => {
                if (taskElement.closest('[data-task-exiting="true"]')) return;
                const taskId = taskElement.dataset.taskId;
                if (!taskId) return;
                const taskRect = taskElement.getBoundingClientRect();
                groupTaskRects.set(taskId, taskRect);
                nextTaskRectsById.set(taskId, taskRect);
                const previousTaskRect = layoutSnapshot?.taskRectsById.get(taskId)
                    ?? previousTaskRectsByIdRef.current.get(taskId)
                    ?? previousGroupTaskRects?.get(taskId);
                const isReturnEntry = entrySource?.taskId === taskId && !previousTaskRect;
                const previousOwner = previousLayout?.taskOwnerById.get(taskId);
                if (isReturnEntry) {
                    animateEntry(`task:${taskId}`, taskElement, entrySource.top, taskAnimationDuration, taskAnimationEasing);
                } else if (previousOwner && previousOwner !== itemId && previousTaskRect) {
                    animateElement(`task:${taskId}`, taskElement, previousTaskRect, taskRect,
                        taskAnimationDuration, taskAnimationEasing);
                } else if (sameItemOrder && !groupMoved && groupTaskLayoutChanged) {
                    if (previousTaskRect) {
                        animateElement(`task:${taskId}`, taskElement, previousTaskRect, taskRect,
                            taskAnimationDuration, taskAnimationEasing);
                    } else if (onlyGroupTaskAdditions) {
                        animateEntry(`task:${taskId}`, taskElement, null, taskAnimationDuration, taskAnimationEasing);
                    }
                }
            });
            nextGroupTaskRects.set(itemId, groupTaskRects);
        });

        previousLayoutRef.current = {
            itemIds: nextItemIds,
            groupTaskIds: nextGroupTaskIds,
            taskCompletionById: nextTaskCompletionById,
            taskOwnerById: nextTaskOwnerById,
        };
        previousItemRectsRef.current = nextItemRects;
        previousGroupTaskRectsRef.current = nextGroupTaskRects;
        previousTaskRectsByIdRef.current = nextTaskRectsById;
        if (layoutSnapshotRef.current === layoutSnapshot) layoutSnapshotRef.current = null;
    }, [entrySource, layoutSignature, layoutSnapshotRef, layoutVisibilityKey, renderedItems]);

    useEffect(() => () => {
        animationTimersRef.current.forEach(timer => window.clearTimeout(timer));
        animationTimersRef.current.clear();
    }, []);

    return (
        <>
            {renderedItems.map(item => {
                const itemId = taskListItemId(item);
                const exiting = animateRemovals && exitingItemIds.has(itemId);
                return (
                    <Collapse
                        key={itemId}
                        in={!exiting}
                        timeout={TASK_EXIT_DURATION_MS}
                        easing={{
                            enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
                            exit: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        unmountOnExit
                        onExited={() => {
                            if (currentItemIdsRef.current.has(itemId)) return;

                            exitingItemIdsRef.current.delete(itemId);
                            setExitingItemIds(new Set(exitingItemIdsRef.current));
                            const remainingItems = displayedItemsRef.current.filter(
                                displayedItem => taskListItemId(displayedItem) !== itemId,
                            );
                            displayedItemsRef.current = remainingItems;
                            setDisplayedItems(remainingItems);
                            if (exitingItemIdsRef.current.size === 0) onAnimatingChange?.(false);
                        }}
                    >
                        <Box
                            ref={(element: HTMLDivElement | null) => {
                                if (element) itemElementsRef.current.set(itemId, element);
                                else itemElementsRef.current.delete(itemId);
                            }}
                            data-home-task-layout-scope={layoutScope}
                            data-home-task-layout-item={itemId}
                            data-home-list-exiting={exiting ? 'true' : undefined}
                            sx={{
                                opacity: exiting ? 0 : 1,
                                transform: exiting ? 'translateY(-4px)' : 'translateY(0)',
                                transition: `opacity ${TASK_EXIT_DURATION_MS}ms ease-out, transform ${TASK_EXIT_DURATION_MS}ms ease-out`,
                            }}
                        >
                            {renderItem(item)}
                        </Box>
                    </Collapse>
                );
            })}
        </>
    );
}

function sameTaskGroup(first: TaskGroup, second: TaskGroup): boolean {
    return first.groupId === second.groupId
        && first.name === second.name
        && first.displayOrder === second.displayOrder
        && first.linkedToMentalThread === second.linkedToMentalThread
        && first.taskIds.length === second.taskIds.length
        && first.taskIds.every((taskId, index) => taskId === second.taskIds[index]);
}

function replaceTaskGroupIfChanged(
    previous: TaskGroup[] | null,
    updatedGroup: TaskGroup,
): TaskGroup[] | null {
    if (!previous) return previous;

    let changed = false;
    const next = previous.map(existingGroup => {
        if (existingGroup.groupId !== updatedGroup.groupId || sameTaskGroup(existingGroup, updatedGroup)) {
            return existingGroup;
        }

        changed = true;
        return updatedGroup;
    });

    return changed ? next : previous;
}

function replaceTaskIdInGroup(
    previous: TaskGroup[] | null,
    groupId: string,
    previousTaskId: string,
    nextTaskId: string,
): TaskGroup[] | null {
    if (!previous) return previous;

    let changed = false;
    const next = previous.map(group => {
        if (group.groupId !== groupId || !group.taskIds.includes(previousTaskId)) return group;

        changed = true;
        return {
            ...group,
            taskIds: group.taskIds.map(taskId => taskId === previousTaskId ? nextTaskId : taskId),
        };
    });

    return changed ? next : previous;
}

function removeTaskIdFromGroup(
    previous: TaskGroup[] | null,
    groupId: string,
    taskId: string,
): TaskGroup[] | null {
    if (!previous) return previous;

    let changed = false;
    const next = previous.map(group => {
        if (group.groupId !== groupId || !group.taskIds.includes(taskId)) return group;

        changed = true;
        return { ...group, taskIds: group.taskIds.filter(candidate => candidate !== taskId) };
    });

    return changed ? next : previous;
}

function formatLocalDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function isSameLocalDay(first: Date, second: Date): boolean {
    return first.getFullYear() === second.getFullYear()
        && first.getMonth() === second.getMonth()
        && first.getDate() === second.getDate();
}

function formatTaskDateForFeedback(value: string): string {
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

function isScheduledForToday(task: Task): boolean {
    if (!task.scheduledPerformDateTime) return false;
    const scheduledDate = new Date(task.scheduledPerformDateTime);
    return !Number.isNaN(scheduledDate.getTime()) && isSameLocalDay(scheduledDate, new Date());
}

function moveTaskDateToToday(task: Task): string {
    const today = new Date();
    const scheduledDate = task.scheduledPerformDateTime
        ? new Date(task.scheduledPerformDateTime)
        : today;
    const nextDate = Number.isNaN(scheduledDate.getTime()) ? today : scheduledDate;
    nextDate.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    return formatLocalDateTime(nextDate);
}

function reorderTaskIdsForCompletion(
    taskIds: string[],
    taskId: string,
    completed: boolean,
    tasks: Task[],
    completionGroupTaskIdsByTaskId: Map<string, string[]>,
): string[] {
    const insertAtCompletionBoundary = (remainingTaskIds: string[], movedTaskIds: string[]) => {
        const taskById = new Map(tasks.map(candidate => [candidate.taskId, candidate]));
        const openTaskIds = remainingTaskIds.filter(id => !taskById.get(id)?.completed);
        const completedTaskIds = remainingTaskIds.filter(id => taskById.get(id)?.completed);
        return [...openTaskIds, ...movedTaskIds, ...completedTaskIds];
    };
    const renderedGroupTaskIds = completionGroupTaskIdsByTaskId.get(taskId);
    if (!renderedGroupTaskIds) {
        const remainingTaskIds = taskIds.filter(id => id !== taskId);
        return insertAtCompletionBoundary(remainingTaskIds, [taskId]);
    }

    const taskIdSet = new Set(taskIds);
    const groupTaskIdsInCurrentOrder = renderedGroupTaskIds.filter(groupTaskId => taskIdSet.has(groupTaskId));
    if (groupTaskIdsInCurrentOrder.length < 2) {
        const remainingTaskIds = taskIds.filter(id => id !== taskId);
        return insertAtCompletionBoundary(remainingTaskIds, [taskId]);
    }

    const tasksById = new Map(tasks.map(task => [task.taskId, task]));
    const groupTasks = groupTaskIdsInCurrentOrder.map(groupTaskId => tasksById.get(groupTaskId));
    if (groupTasks.some(groupTask => !groupTask)) return taskIds;

    const allCompleted = groupTasks.every(groupTask => (
        groupTask!.taskId === taskId ? completed : groupTask!.completed
    ));
    const allReopened = groupTasks.every(groupTask => (
        groupTask!.taskId === taskId ? !completed : !groupTask!.completed
    ));
    // Keep a mixed group in its current position until it reaches a uniform completion state.
    if (!allCompleted && !allReopened) return taskIds;

    const groupTaskIds = new Set(groupTaskIdsInCurrentOrder);
    const groupIdsInOrder = taskIds.filter(id => groupTaskIds.has(id));
    if (groupIdsInOrder.length !== groupTaskIdsInCurrentOrder.length) return taskIds;

    const remainingTaskIds = taskIds.filter(id => !groupTaskIds.has(id));
    const nextTaskIds = insertAtCompletionBoundary(remainingTaskIds, groupIdsInOrder);
    return nextTaskIds.every((id, index) => id === taskIds[index]) ? taskIds : nextTaskIds;
}

function reorderTaskIdsForCompletionChanges(
    taskIds: string[],
    changes: Array<{ taskId: string; completed: boolean }>,
    tasks: Task[],
    completionGroupTaskIdsByTaskId: Map<string, string[]>,
): string[] {
    let nextTaskIds = taskIds;
    let nextTasks = tasks;
    changes.forEach(({ taskId, completed }) => {
        nextTaskIds = reorderTaskIdsForCompletion(
            nextTaskIds,
            taskId,
            completed,
            nextTasks,
            completionGroupTaskIdsByTaskId,
        );
        nextTasks = nextTasks.map(task => task.taskId === taskId ? { ...task, completed } : task);
    });
    return nextTaskIds;
}

function reorderTaskSnapshot(tasks: Task[], orderedTaskIds: string[]): Task[] {
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

function createOptimisticTask(taskToCreate: TaskToCreate): Task {
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

export function HomePage() {
    const { user } = useUser();
    const {
        activePomodoro,
        pomodoroStatusResolved,
        refreshActivePomodoro,
    } = usePomodoro();
    const restoredPomodoro = activePomodoro?.active ? activePomodoro : null;
    const restoredPomodoroTaskId = restoredPomodoro?.associatedTaskId ?? null;
    const location = useLocation();
    const navigate = useNavigate();
    const [animateGreeting] = useState(() => !hasAnimatedHomeGreeting);
    const [activeExpansion, setActiveExpansion] = useState<ActiveExpansion>(() => (
        restoredPomodoroTaskId
            ? { taskId: restoredPomodoroTaskId, panel: 'pomodoro' }
            : readHomeActiveExpansion()
    ));
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(() => (
        activeExpansion ? [activeExpansion.taskId] : []
    ));
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
    const [selectionActionsPosition, setSelectionActionsPosition] = useState<{ top: number; left: number } | null>(null);
    const [taskFeedback, setTaskFeedback] = useState<TaskFeedback | null>(null);
    const [pendingHomeDateTaskIds, setPendingHomeDateTaskIds] = useState<string[]>([]);
    const [pendingDeletedTaskIds, setPendingDeletedTaskIds] = useState<string[]>([]);
    const [homeTaskListAnimating, setHomeTaskListAnimating] = useState(false);
    const [showOlderTasks, setShowOlderTasks] = useState(false);
    const [showCompletionDetails, setShowCompletionDetails] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [taskContextMenu, setTaskContextMenu] = useState<TaskContextMenuState | null>(null);
    const [taskReminderEditor, setTaskReminderEditor] = useState<TaskReminderEditorState | null>(null);
    const [groupAnchorEl, setGroupAnchorEl] = useState<HTMLElement | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupSubmitting, setGroupSubmitting] = useState(false);
    const [parentTaskAnchorEl, setParentTaskAnchorEl] = useState<HTMLElement | null>(null);
    const [parentTaskSubmitting, setParentTaskSubmitting] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [localGroupName, setLocalGroupName] = useState('');
    const [groupAddingTaskId, setGroupAddingTaskId] = useState<string | null>(null);
    const [groupTaskInputGeneration, setGroupTaskInputGeneration] = useState(0);
    const [bulkDateAnchorEl, setBulkDateAnchorEl] = useState<HTMLElement | null>(null);
    const [bulkDateDraft, setBulkDateDraft] = useState(() => new Date());
    const [cachedGroups] = useState(() => taskGroupService.getCachedGroups());
    const [groups, setGroups] = useState<TaskGroup[] | null>(() => cachedGroups ?? null);
    const groupsRef = useRef(groups);
    groupsRef.current = groups;
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
        () => collapsedHomeGroupIds(cachedGroups ?? []),
    );
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const groupNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const [draggedTaskIds, setDraggedTaskIds] = useState<string[]>([]);
    const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
    const [dragTargetTaskId, setDragTargetTaskId] = useState<string | null>(null);
    const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
    const [dragTargetPosition, setDragTargetPosition] = useState<GroupDropIntent | null>(null);
    const [dragEdge, setDragEdge] = useState<'top' | 'bottom' | null>(null);
    const [activePomodoroTaskId, setActivePomodoroTaskId] = useState<string | null>(restoredPomodoroTaskId);
    const [initialPomodoroStatus, setInitialPomodoroStatus] = useState<PomodoroStatus | null>(restoredPomodoro);
    const [resolvedActivePomodoroTask, setResolvedActivePomodoroTask] = useState<Task | null>(null);
    const [pomodoroTaskMinimized, setPomodoroTaskMinimized] = useState(false);
    const [focusVisibility, setFocusVisibility] = useState<FocusVisibility>(
        restoredPomodoro ? 'hidden' : 'all',
    );
    const [focusTaskOffset, setFocusTaskOffset] = useState(0);
    const [taskReturnEntry, setTaskReturnEntry] = useState<{ taskId: string; top: number } | null>(null);
    const selectionAnchorRef = useRef<string | null>(activeExpansion?.taskId ?? null);
    const activePomodoroTaskIdRef = useRef<string | null>(restoredPomodoroTaskId);
    const handledFocusNavigationTaskIdRef = useRef<string | null>(null);
    const focusTaskSourceTopRef = useRef<number | null>(null);
    const latestPomodoroStatusRef = useRef<PomodoroStatus | null>(restoredPomodoro);
    const taskListTopRef = useRef<HTMLDivElement | null>(null);
    const focusedPomodoroRowRef = useRef<HTMLDivElement | null>(null);
    const olderTasksSectionRef = useRef<HTMLDivElement | null>(null);
    const completionCardExpansionRef = useRef(false);
    const selectionActionsRef = useRef<HTMLDivElement | null>(null);
    const taskFeedbackIdRef = useRef(0);
    const pendingUndoRef = useRef<PendingUndo | null>(null);
    const pendingHomeDateEditsRef = useRef(new Map<string, PendingHomeDateEdit>());
    const focusTransitionTimerRef = useRef<number | null>(null);
    const temporarilyCollapsedGroupIdRef = useRef<string | null>(null);
    const groupTaskSubmissionRef = useRef(false);
    const activeDragRef = useRef<ActiveDrag | null>(null);
    const taskRenderKeysRef = useRef(new Map<string, string>());
    const todayLayoutSnapshotRef = useRef<HomeTaskLayoutSnapshot | null>(null);
    const olderLayoutSnapshotRef = useRef<HomeTaskLayoutSnapshot | null>(null);

    const captureHomeTaskLayout = useCallback(() => {
        const todaySnapshot: HomeTaskLayoutSnapshot = {
            itemRects: new Map(),
            taskRectsById: new Map(),
            completionChange: true,
        };
        const olderSnapshot: HomeTaskLayoutSnapshot = {
            itemRects: new Map(),
            taskRectsById: new Map(),
            completionChange: true,
        };

        document.querySelectorAll<HTMLElement>(
            '[data-home-task-layout-scope][data-home-task-layout-item]',
        ).forEach(itemElement => {
            if (itemElement.dataset.homeListExiting === 'true') return;
            const snapshot = itemElement.dataset.homeTaskLayoutScope === 'older'
                ? olderSnapshot
                : todaySnapshot;
            const itemId = itemElement.dataset.homeTaskLayoutItem;
            if (!itemId) return;

            snapshot.itemRects.set(itemId, itemElement.getBoundingClientRect());
            itemElement.querySelectorAll<HTMLElement>('[data-task-id]').forEach(taskElement => {
                if (taskElement.closest('[data-task-exiting="true"]')) return;
                const taskId = taskElement.dataset.taskId;
                if (taskId) snapshot.taskRectsById.set(taskId, taskElement.getBoundingClientRect());
            });
        });

        todayLayoutSnapshotRef.current = todaySnapshot;
        olderLayoutSnapshotRef.current = olderSnapshot;
        window.setTimeout(() => {
            if (todayLayoutSnapshotRef.current === todaySnapshot) todayLayoutSnapshotRef.current = null;
            if (olderLayoutSnapshotRef.current === olderSnapshot) olderLayoutSnapshotRef.current = null;
        }, TASK_COMPLETION_REORDER_DURATION_MS + 80);

        document.querySelectorAll<HTMLElement>('[data-home-flip-active="true"]').forEach(element => {
            element.style.transition = 'none';
            element.style.transform = '';
            delete element.dataset.homeFlipActive;
            void element.offsetHeight;
            element.style.transition = '';
        });
    }, []);

    const rememberTaskRenderKey = useCallback((taskId: string, renderKey: string) => {
        if (!taskRenderKeysRef.current.has(taskId)) {
            taskRenderKeysRef.current.set(taskId, renderKey);
        }
    }, []);

    const getTaskRenderKey = useCallback((taskId: string) => (
        `task:${taskRenderKeysRef.current.get(taskId) ?? taskId}`
    ), []);

    useEffect(() => {
        try {
            const storageKey = homeActiveExpansionStorageKey();
            if (activeExpansion) {
                window.sessionStorage.setItem(storageKey, JSON.stringify(activeExpansion));
            } else {
                window.sessionStorage.removeItem(storageKey);
            }
        } catch (error) {
            console.warn('Could not persist the expanded Home task:', error);
        }
    }, [activeExpansion]);

    useEffect(() => {
        if (animateGreeting) hasAnimatedHomeGreeting = true;
    }, [animateGreeting]);

    const getDraggedTaskIds = useCallback(() => {
        const activeDrag = activeDragRef.current;
        return activeDrag?.kind === 'tasks' ? activeDrag.taskIds : [];
    }, []);

    const getDraggedGroupId = useCallback(() => {
        const activeDrag = activeDragRef.current;
        return activeDrag?.kind === 'group' ? activeDrag.groupId : null;
    }, []);

    const getDraggedPreservedGroupIds = useCallback(() => {
        const activeDrag = activeDragRef.current;
        return activeDrag?.kind === 'tasks' ? activeDrag.preservedGroupIds : [];
    }, []);

    const getPrimaryDraggedTaskId = useCallback(() => {
        const activeDrag = activeDragRef.current;
        return activeDrag?.kind === 'tasks' ? activeDrag.primaryTaskId : null;
    }, []);

    const hasActiveDrag = useCallback(() => activeDragRef.current !== null, []);

    const showTaskFeedback = useCallback((severity: TaskFeedback['severity'], message: string) => {
        taskFeedbackIdRef.current += 1;
        setTaskFeedback({ id: taskFeedbackIdRef.current, severity, message });
    }, []);

    function showTaskCreationDateFeedback(scheduledPerformDateTime?: string) {
        if (!scheduledPerformDateTime) return;

        const scheduledDate = new Date(scheduledPerformDateTime);
        if (Number.isNaN(scheduledDate.getTime()) || isSameLocalDay(scheduledDate, new Date())) return;

        showTaskFeedback(
            'success',
            `Task was created for ${formatTaskDateForFeedback(scheduledPerformDateTime)}`,
        );
    }

    const showUndoFeedback = useCallback((
        message: string,
        undo: () => void | Promise<void>,
        commit: () => void | Promise<void> = () => {},
        severity: TaskFeedback['severity'] = 'success',
    ) => {
        const previousUndo = pendingUndoRef.current;
        if (previousUndo) {
            window.clearTimeout(previousUndo.timeoutId);
            void previousUndo.commit();
        }

        const timeoutId = window.setTimeout(() => {
            if (pendingUndoRef.current?.timeoutId !== timeoutId) return;
            pendingUndoRef.current = null;
            setTaskFeedback(previous => previous?.undo === undo ? null : previous);
            void commit();
        }, 5000);
        pendingUndoRef.current = { timeoutId, commit };
        taskFeedbackIdRef.current += 1;
        setTaskFeedback({ id: taskFeedbackIdRef.current, severity, message, undo });
    }, []);

    const {
        allTasks,
        todayTasks,
        pastTasks,
        tasksLoaded,
        todayTasksLoaded,
        allTasksSynchronized,
        refreshTaskBuckets,
        addTaskToState,
        replaceTaskInState,
        updateTaskInState,
        updateTasksInState,
        removeTaskFromState,
        reorderTasksInState,
    } = useGlobalTasks({ prioritizeToday: true });
    const allTasksRef = useRef(allTasks);
    allTasksRef.current = allTasks;
    const manualTaskOrderRevisionRef = useRef(0);
    const taskOrderMutationRef = useRef(Promise.resolve());
    const completionMutationRef = useRef(new Map<string, Promise<void>>());
    const completionRequestIdRef = useRef(new Map<string, number>());
    const completionConfirmedStateRef = useRef(new Map<string, boolean>());

    const saveTaskOrder = useCallback(async (
        orderedTaskIds: string[],
        expectedRevision = manualTaskOrderRevisionRef.current,
        failOnError = false,
    ) => {
        const request = taskOrderMutationRef.current
            .catch(() => {})
            .then(async () => {
                if (expectedRevision !== manualTaskOrderRevisionRef.current) return;
                await taskService.reorderTasks(orderedTaskIds);
            });
        taskOrderMutationRef.current = request.then(() => {}, () => {});

        try {
            await request;
        } catch (error) {
            console.error('Error reordering tasks:', error);
            if (expectedRevision === manualTaskOrderRevisionRef.current) {
                await refreshTaskBuckets(true);
            }
            if (failOnError) throw error;
        }
    }, [refreshTaskBuckets]);

    const pendingDeletedTaskIdSet = useMemo(
        () => new Set(pendingDeletedTaskIds),
        [pendingDeletedTaskIds],
    );
    const activePomodoroTaskIdForHome = activePomodoro?.active
        ? activePomodoro.associatedTaskId
        : activePomodoroTaskId;
    const homeTodayTasks = useMemo(() => {
        const seenTaskIds = new Set<string>();
        const mergedTasks: Task[] = [];
        const taskById = new Map(allTasks.map(task => [task.taskId, task] as const));
        const addMainTask = (task: Task) => {
            const latestTask = taskById.get(task.taskId);
            const taskToAdd = latestTask ?? task;
            if (taskToAdd.parentId || seenTaskIds.has(taskToAdd.taskId)) return;
            if (latestTask && !isScheduledForToday(latestTask)
                && latestTask.taskId !== activePomodoroTaskIdForHome) return;
            seenTaskIds.add(task.taskId);
            mergedTasks.push(taskToAdd);
        };

        todayTasks.forEach(addMainTask);
        allTasks.forEach(task => {
            if (isScheduledForToday(task) || task.taskId === activePomodoroTaskIdForHome) {
                addMainTask(task);
            }
        });
        if (resolvedActivePomodoroTask?.taskId === activePomodoroTaskIdForHome) {
            addMainTask(resolvedActivePomodoroTask);
        }

        return mergedTasks;
    }, [activePomodoroTaskIdForHome, allTasks, resolvedActivePomodoroTask, todayTasks]);
    const todayTasksForCompletion = useMemo(() => homeTodayTasks.filter(task => (
        isScheduledForToday(task) && !pendingDeletedTaskIdSet.has(task.taskId)
    )), [homeTodayTasks, pendingDeletedTaskIdSet]);
    const allTodayTasksComplete = todayTasksForCompletion.length > 0
        && todayTasksForCompletion.every(task => task.completed);

    useLayoutEffect(() => {
        if (!allTodayTasksComplete) {
            setShowCompletionDetails(false);
            completionCardExpansionRef.current = false;
        }
    }, [allTodayTasksComplete]);

    const visibleTasks = useMemo(
        () => {
            const showCompletedToday = allTodayTasksComplete
                ? showCompletionDetails
                : getShowCompletedHomeTasks() || !getExcludeTodayCompletedHomeTasks();
            const todayTaskIds = new Set(homeTodayTasks.map(task => task.taskId));
            const pendingDateTasks = pendingHomeDateTaskIds
                .map(taskId => allTasks.find(task => task.taskId === taskId))
                .filter((task): task is Task => task !== undefined && !todayTaskIds.has(task.taskId))
                .sort((first, second) => (
                    (pendingHomeDateEditsRef.current.get(first.taskId)?.originalIndex ?? Number.MAX_SAFE_INTEGER)
                    - (pendingHomeDateEditsRef.current.get(second.taskId)?.originalIndex ?? Number.MAX_SAFE_INTEGER)
                ));
            const tasksInOriginalOrder = [...homeTodayTasks];
            pendingDateTasks.forEach(task => {
                const originalIndex = pendingHomeDateEditsRef.current.get(task.taskId)?.originalIndex
                    ?? tasksInOriginalOrder.length;
                tasksInOriginalOrder.splice(Math.min(originalIndex, tasksInOriginalOrder.length), 0, task);
            });
            return tasksInOriginalOrder
                .filter(task => !pendingDeletedTaskIdSet.has(task.taskId))
                .filter(task => !task.parentId && (
                    showCompletedToday
                    || !task.completed
                    || task.taskId === activePomodoroTaskIdForHome
                ));
        },
        [activePomodoroTaskIdForHome, allTasks, allTodayTasksComplete, homeTodayTasks,
            pendingDeletedTaskIdSet, pendingHomeDateTaskIds, showCompletionDetails],
    );
    const olderTasks = useMemo(
        () => pastTasks.filter(task => !pendingDeletedTaskIdSet.has(task.taskId)
            && !task.parentId && !task.completed),
        [pastTasks, pendingDeletedTaskIdSet],
    );
    const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
    const selectedGroupIdSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
    const selectableGroups = useMemo(
        () => groups ?? [],
        [groups],
    );
    const selectedGroupTaskIdSet = useMemo(
        () => new Set(selectableGroups
            .filter(group => selectedGroupIdSet.has(group.groupId))
            .flatMap(group => group.taskIds)),
        [selectableGroups, selectedGroupIdSet],
    );
    const selectedActionTaskIdSet = useMemo(
        () => new Set([...selectedTaskIds, ...selectedGroupTaskIdSet]),
        [selectedGroupTaskIdSet, selectedTaskIds],
    );
    const selectedTasks = useMemo(
        () => allTasks.filter(task => selectedActionTaskIdSet.has(task.taskId)),
        [allTasks, selectedActionTaskIdSet],
    );
    const hasOnlyOriginGroupSelection = selectedGroupIds.length > 0
        && selectedGroupIds.every(groupId => selectableGroups.some(group => (
            group.groupId === groupId && (group.isStatGroup || group.linkedToMentalThread)
        )));
    const olderTaskIdSet = useMemo(() => new Set(olderTasks.map(task => task.taskId)), [olderTasks]);
    const selectedOlderTasks = useMemo(
        () => selectedTasks.filter(task => olderTaskIdSet.has(task.taskId)),
        [olderTaskIdSet, selectedTasks],
    );
    const selectionEntityCount = selectedTaskIds.length + selectedGroupIds.length;
    const selectionActionsVisible = selectionEntityCount > 1 || selectedGroupIds.length > 0;
    const canGroupSelectedTasks = (selectedGroupIds.length === 0 && selectedTaskIds.length >= 2)
        || (hasOnlyOriginGroupSelection && selectedTasks.length >= 2);
    const canCreateParentTask = (selectedGroupIds.length === 0 || hasOnlyOriginGroupSelection)
        && selectedTasks.length >= 2
        && selectedTasks.length === selectedActionTaskIdSet.size
        && selectedTasks.every(task => !task.parentId && !task.taskSeriesId);

    useKeyboardDelete({
        enabled: selectionEntityCount > 0
            && !deleteRequest && !deleteSubmitting && !bulkActionLoading,
        onDelete: () => {
            const selectedGroupId = [...selectedGroupIds].reverse().find(groupId =>
                (groups ?? []).some(group => group.groupId === groupId),
            );
            if (selectedGroupId) {
                const group = (groups ?? []).find(candidate => candidate.groupId === selectedGroupId);
                if (group) {
                    const anchorEl = findKeyboardDeleteAnchor('data-task-group-id', group.groupId) ?? document.body;
                    if (group.isStatGroup) requestBulkDelete(anchorEl);
                    else requestGroupDelete(group, anchorEl);
                }
                return;
            }

            if (selectedTasks.length === 1) {
                const task = selectedTasks[0];
                deleteTask(task, findKeyboardDeleteAnchor('data-task-id', task.taskId) ?? document.body);
            } else if (selectedTasks.length > 1) {
                requestBulkDelete(
                    findKeyboardDeleteAnchor('data-task-id', selectedTasks[selectedTasks.length - 1].taskId) ?? document.body,
                );
            }
        },
    });

    const activePomodoroTaskIdForRender = activePomodoroTaskIdForHome;
    const activePomodoroTaskFromState = useMemo(
        () => allTasks.find(task => task.taskId === activePomodoroTaskIdForRender)
            ?? visibleTasks.find(task => task.taskId === activePomodoroTaskIdForRender)
            ?? null,
        [activePomodoroTaskIdForRender, allTasks, visibleTasks],
    );
    const activePomodoroTaskRequestRef = useRef<string | null>(null);

    useEffect(() => {
        const taskId = activePomodoroTaskIdForRender;
        if (!taskId) {
            activePomodoroTaskRequestRef.current = null;
            setResolvedActivePomodoroTask(null);
            return;
        }

        if (activePomodoroTaskFromState) {
            activePomodoroTaskRequestRef.current = taskId;
            setResolvedActivePomodoroTask(previous => (
                previous?.taskId === taskId && previous === activePomodoroTaskFromState
                    ? previous
                    : activePomodoroTaskFromState
            ));
            return;
        }

        if (activePomodoroTaskRequestRef.current === taskId) return;
        activePomodoroTaskRequestRef.current = taskId;
        let cancelled = false;
        taskService.getTask(taskId)
            .then(task => {
                if (!cancelled) setResolvedActivePomodoroTask(task);
            })
            .catch(error => {
                if (!cancelled) {
                    console.error('Could not load the active task for Home:', error);
                    setResolvedActivePomodoroTask(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activePomodoroTaskFromState, activePomodoroTaskIdForRender]);

    const activePomodoroTask = useMemo(
        () => activePomodoroTaskFromState
            ?? (resolvedActivePomodoroTask?.taskId === activePomodoroTaskIdForRender
                ? resolvedActivePomodoroTask
                : null)
            ?? null,
        [activePomodoroTaskFromState, activePomodoroTaskIdForRender, resolvedActivePomodoroTask],
    );
    const focusedPomodoroTask = useMemo(
        () => pomodoroTaskMinimized ? null : activePomodoroTask,
        [activePomodoroTask, pomodoroTaskMinimized],
    );
    const homeDetailTasks = useMemo(() => {
        const tasksById = new Map<string, Task>();
        [...visibleTasks, ...olderTasks, ...(focusedPomodoroTask ? [focusedPomodoroTask] : [])]
            .forEach(task => tasksById.set(task.taskId, task));
        return [...tasksById.values()];
    }, [focusedPomodoroTask, olderTasks, visibleTasks]);

    useEffect(() => {
        let cancelled = false;
        let nextTaskIndex = 0;

        const prefetchWorker = async () => {
            while (!cancelled) {
                const task = homeDetailTasks[nextTaskIndex];
                nextTaskIndex += 1;
                if (!task) return;

                try {
                    await taskService.getTaskDetails(task);
                } catch (error) {
                    console.error('Error prefetching Home task details:', error);
                }
            }
        };

        // Detail requests include subtasks and sometimes a recurring series.
        // Limit concurrent tasks so warming a large Home list stays bounded.
        void Promise.all(Array.from(
            { length: Math.min(4, homeDetailTasks.length) },
            () => prefetchWorker(),
        ));

        return () => {
            cancelled = true;
        };
    }, [homeDetailTasks]);
    const tasksBelowFocus = useMemo(
        () => focusedPomodoroTask
            ? visibleTasks.filter(task => task.taskId !== focusedPomodoroTask.taskId)
            : visibleTasks,
        [focusedPomodoroTask, visibleTasks],
    );
    const taskListItems = useMemo(
        () => buildTaskListItems(tasksBelowFocus, groups ?? [], getTaskRenderKey, 'today', homeTodayTasks),
        [getTaskRenderKey, groups, homeTodayTasks, tasksBelowFocus],
    );
    const olderTaskListItems = useMemo(
        () => buildTaskListItems(olderTasks, groups ?? [], getTaskRenderKey, 'older', pastTasks),
        [getTaskRenderKey, groups, olderTasks, pastTasks],
    );
    const focusedPomodoroTaskId = focusedPomodoroTask?.taskId;
    const completionGroupTaskIdsByTaskId = useMemo(() => mergeCompletionGroupTaskIdsByTaskId(
        buildCompletionGroupTaskIdsByTaskId(
            taskListItems,
            homeTodayTasks.filter(task => task.taskId !== focusedPomodoroTaskId),
        ),
        buildCompletionGroupTaskIdsByTaskId(olderTaskListItems, pastTasks),
    ), [focusedPomodoroTaskId, homeTodayTasks, olderTaskListItems, pastTasks, taskListItems]);
    const completionGroupTaskIdsByTaskIdRef = useRef(completionGroupTaskIdsByTaskId);
    completionGroupTaskIdsByTaskIdRef.current = completionGroupTaskIdsByTaskId;
    const renderedSelectionEntities = useMemo(() => {
        const entities: SelectionEntity[] = focusedPomodoroTask
            ? [{ kind: 'task', id: focusedPomodoroTask.taskId }]
            : [];

        const appendItems = (items: TaskListItem[]) => {
            items.forEach(item => {
                if (item.kind === 'task') {
                    entities.push({ kind: 'task', id: item.task.taskId });
                    return;
                }

                entities.push({ kind: 'group', id: item.group.groupId });
                if (!collapsedGroupIds.has(item.expansionId)) {
                    item.tasks.forEach(task => entities.push({ kind: 'task', id: task.taskId }));
                }
            });
        };

        appendItems(taskListItems);
        if (showOlderTasks) appendItems(olderTaskListItems);
        return entities;
    }, [focusedPomodoroTask, collapsedGroupIds, olderTaskListItems, showOlderTasks, taskListItems]);

    const homeContentReady = tasksLoaded || todayTasksLoaded || focusedPomodoroTask !== null;
    // A task refresh temporarily clears allTasksSynchronized. Home already has
    // a usable snapshot once tasksLoaded is true, so keep these controls mounted
    // during later refreshes instead of collapsing and reopening the older list.
    const homeTaskControlsReady = homeContentReady && tasksLoaded && pomodoroStatusResolved && groups !== null;

    useEffect(() => {
        const navigationState = location.state as { openPomodoroTaskId?: unknown } | null;
        const taskId = navigationState?.openPomodoroTaskId;
        if (typeof taskId !== 'string' || handledFocusNavigationTaskIdRef.current === taskId) return;
        if (!homeContentReady || !allTasksSynchronized) return;
        if (!allTasks.some(task => task.taskId === taskId)) return;

        handledFocusNavigationTaskIdRef.current = taskId;
        setActiveExpansion({ taskId, panel: 'pomodoro' });
        setSelectedTaskIds([taskId]);
        setSelectedGroupIds([]);
        navigate('/', { replace: true, state: null });
    }, [allTasks, allTasksSynchronized, homeContentReady, location.state, navigate]);

    const updateSelectionActionsPosition = useCallback(() => {
        if (!selectionActionsVisible) {
            return;
        }

        const selectedRows = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
            .filter(row => selectedActionTaskIdSet.has(row.dataset.taskId ?? ''));
        const selectedGroupRows = Array.from(document.querySelectorAll<HTMLElement>('[data-task-group-id]'))
            .filter(row => selectedGroupIdSet.has(row.dataset.taskGroupId ?? ''));
        const rows = [...selectedRows, ...selectedGroupRows];
        if (rows.length === 0) {
            setSelectionActionsPosition(null);
            return;
        }

        const bounds = rows.map(row => row.getBoundingClientRect());
        const rowCenters = bounds.map(rect => rect.top + rect.height / 2);
        const top = (Math.min(...rowCenters) + Math.max(...rowCenters)) / 2;
        const right = Math.max(...bounds.map(rect => rect.right));
        const popupWidth = selectionActionsRef.current?.getBoundingClientRect().width
            ?? SELECTION_ACTIONS_FALLBACK_WIDTH;
        const maxLeft = window.innerWidth - popupWidth - SELECTION_ACTIONS_EDGE_PADDING;
        const left = Math.min(
            Math.max(right + SELECTION_ACTIONS_GAP, SELECTION_ACTIONS_EDGE_PADDING),
            Math.max(SELECTION_ACTIONS_EDGE_PADDING, maxLeft),
        );
        const nextPosition = {
            top: Math.round(top),
            left: Math.round(left),
        };

        setSelectionActionsPosition(previous => (
            previous?.top === nextPosition.top && previous.left === nextPosition.left
                ? previous
                : nextPosition
        ));
    }, [selectedActionTaskIdSet, selectedGroupIdSet, selectionActionsVisible]);

    useLayoutEffect(() => {
        if (!selectionActionsVisible) {
            return undefined;
        }

        updateSelectionActionsPosition();

        const handleViewportChange = () => updateSelectionActionsPosition();
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        const resizeObserver = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(handleViewportChange);
        if (resizeObserver) {
            document.querySelectorAll<HTMLElement>('[data-task-id]').forEach(row => {
                if (selectedActionTaskIdSet.has(row.dataset.taskId ?? '')
                    || selectedGroupIdSet.has(row.dataset.taskGroupId ?? '')) resizeObserver.observe(row);
            });
            document.querySelectorAll<HTMLElement>('[data-task-group-id]').forEach(row => {
                if (selectedGroupIdSet.has(row.dataset.taskGroupId ?? '')) resizeObserver.observe(row);
            });
        }

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
            resizeObserver?.disconnect();
        };
    }, [activeExpansion, collapsedGroupIds, focusVisibility, groups, olderTasks, selectedActionTaskIdSet,
        selectedGroupIdSet, selectionActionsVisible, showOlderTasks, updateSelectionActionsPosition, visibleTasks]);

    const clearFocusTransitionTimer = useCallback(() => {
        if (focusTransitionTimerRef.current !== null) {
            window.clearTimeout(focusTransitionTimerRef.current);
            focusTransitionTimerRef.current = null;
        }
    }, []);

    const rememberFocusTaskPosition = useCallback((taskId: string) => {
        const taskRow = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
            .find(element => element.dataset.taskId === taskId);
        focusTaskSourceTopRef.current = taskRow
            ? taskRow.getBoundingClientRect().top + window.scrollY
            : null;
    }, []);

    const finishFocusTransition = useCallback(() => {
        const sourceTop = focusTaskSourceTopRef.current;
        const targetBounds = taskListTopRef.current?.getBoundingClientRect();
        const targetTop = targetBounds ? targetBounds.top + window.scrollY : undefined;
        setFocusTaskOffset(sourceTop !== null && targetTop !== undefined ? sourceTop - targetTop : 0);
        setInitialPomodoroStatus(latestPomodoroStatusRef.current);
        setFocusVisibility('sliding');
        focusTransitionTimerRef.current = window.setTimeout(() => {
            setFocusVisibility('hidden');
            focusTransitionTimerRef.current = null;
        }, FOCUS_TASK_SLIDE_DURATION_MS);
    }, []);

    const refreshGroups = useCallback(async () => {
        try {
            const fetchedGroups = await taskGroupService.getGroups();
            const previousGroups = groupsRef.current ?? [];
            groupsRef.current = fetchedGroups;
            setGroups(fetchedGroups);
            setCollapsedGroupIds(previous => reconcileCollapsedHomeGroupIds(
                previous,
                previousGroups,
                fetchedGroups,
            ));
        } catch (err) {
            console.error('Error fetching task groups:', err);
            setGroups([]);
            groupsRef.current = [];
        }
    }, []);

    useEffect(() => {
        void refreshGroups();
    }, [refreshGroups]);

    useEffect(() => {
        if (!editingGroupId || !groupNameInputRef.current) return;

        const input = groupNameInputRef.current;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, [editingGroupId]);

    function startGroupNameEditing(group: TaskGroup, event: React.MouseEvent<HTMLElement>) {
        event.stopPropagation();
        setEditingGroupId(group.groupId);
        setLocalGroupName(group.name);
    }

    async function commitGroupName(group: TaskGroup) {
        const trimmedName = localGroupName.trim();
        const fallbackName = group.name;

        setEditingGroupId(null);
        setLocalGroupName(trimmedName || fallbackName);
        if (!trimmedName || trimmedName === fallbackName) return;

        try {
            const updatedGroup = await taskGroupService.renameGroup(group.groupId, trimmedName);
            setGroups(previous => replaceTaskGroupIfChanged(previous, updatedGroup));
        } catch (err) {
            console.error('Error renaming task group:', err);
            await refreshGroups();
        }
    }

    function cancelGroupNameEditing(group: TaskGroup) {
        setLocalGroupName(group.name);
        setEditingGroupId(null);
    }

    useEffect(() => () => clearFocusTransitionTimer(), [clearFocusTransitionTimer]);

    useEffect(() => {
        if (!taskReturnEntry) return;
        const timeoutId = window.setTimeout(() => setTaskReturnEntry(null), TASK_REORDER_DURATION_MS);
        return () => window.clearTimeout(timeoutId);
    }, [taskReturnEntry]);

    useEffect(() => () => {
        const pendingUndo = pendingUndoRef.current;
        if (!pendingUndo) return;
        window.clearTimeout(pendingUndo.timeoutId);
        pendingUndoRef.current = null;
        void pendingUndo.commit();
    }, []);

    async function createTask(task: TaskToCreate) {
        if (!task.name.trim()) return;

        const optimisticTask = createOptimisticTask(task);
        rememberTaskRenderKey(optimisticTask.taskId, optimisticTask.taskId);
        addTaskToState(optimisticTask);

        try {
            const created = await taskService.createTask(task);
            if (!task.recurrenceFrequency) {
                setCachedTaskDetails(created.taskId, {
                    task: created,
                    subtasks: [],
                    taskSeries: null,
                });
            }
            rememberTaskRenderKey(created.taskId, optimisticTask.taskId);
            replaceTaskInState(optimisticTask.taskId, created);
            showTaskCreationDateFeedback(task.scheduledPerformDateTime);
        } catch (err) {
            console.error('Error creating task:', err);
            removeTaskFromState(optimisticTask.taskId);
            showTaskFeedback('error', 'Could not add that task right now.');
        }
    }

    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
        const originalTask = allTasks.find(task => task.taskId === taskId);

        if (Object.prototype.hasOwnProperty.call(updates, 'scheduledPerformDateTime') && originalTask) {
            const pendingEdit = pendingHomeDateEditsRef.current.get(taskId);
            const originalDateTime = pendingEdit?.originalDateTime ?? originalTask.scheduledPerformDateTime;
            const latestDateTime = updates.scheduledPerformDateTime || null;
            if (pendingEdit || isScheduledForToday(originalTask)) {
                pendingHomeDateEditsRef.current.set(taskId, {
                    originalDateTime,
                    latestDateTime,
                    originalIndex: pendingEdit?.originalIndex ?? Math.max(
                        0,
                        todayTasks.findIndex(task => task.taskId === taskId),
                    ),
                });
                setPendingHomeDateTaskIds(previous => previous.includes(taskId)
                    ? previous
                    : [...previous, taskId]);
            }
        }

        updateTaskInState(taskId, updates);
        try {
            await taskService.updateTask(taskId, updates);
        } catch (err) {
            console.error('Error updating task:', err);
            if (originalTask) updateTaskInState(taskId, originalTask);
            await refreshTaskBuckets(true);
        }
    }, [allTasks, refreshTaskBuckets, todayTasks, updateTaskInState]);

    const handleScheduledDateEditComplete = useCallback((taskId: string) => {
        const pendingEdit = pendingHomeDateEditsRef.current.get(taskId);
        if (!pendingEdit) return;

        pendingHomeDateEditsRef.current.delete(taskId);
        setPendingHomeDateTaskIds(previous => previous.filter(id => id !== taskId));

        if (pendingEdit.originalDateTime === pendingEdit.latestDateTime) return;

        const isTopLevelTask = taskListItems.some(item => (
            item.kind === 'task' && item.task.taskId === taskId
        ));
        if (isTopLevelTask) setHomeTaskListAnimating(true);

        const message = pendingEdit.latestDateTime
            ? `Task moved to ${formatTaskDateForFeedback(pendingEdit.latestDateTime)}`
            : 'Task removed from Today';
        showUndoFeedback(message, async () => {
            try {
                const restoredTask = await taskService.updateTask(taskId, {
                    scheduledPerformDateTime: pendingEdit.originalDateTime ?? '',
                });
                updateTaskInState(taskId, restoredTask);
            } catch (error) {
                console.error('Error undoing Home task date change:', error);
                await refreshTaskBuckets(true);
            }
        });
    }, [refreshTaskBuckets, showUndoFeedback, taskListItems, updateTaskInState]);

    const toggleTaskCompletion = useCallback(async (taskId: string, anchorEl?: HTMLElement) => {
        const task = allTasksRef.current.find(existingTask => existingTask.taskId === taskId);
        if (task) captureHomeTaskLayout();
        const wasCompleted = task?.completed ?? false;
        const completed = !wasCompleted;
        const completionOrigin = !wasCompleted ? anchorEl?.getBoundingClientRect() : undefined;
        const previousTaskOrder = allTasksRef.current.map(item => item.taskId);
        const nextTaskOrder = task
            ? reorderTaskIdsForCompletion(
                previousTaskOrder,
                taskId,
                completed,
                allTasksRef.current,
                completionGroupTaskIdsByTaskIdRef.current,
            )
            : null;
        const requestId = (completionRequestIdRef.current.get(taskId) ?? 0) + 1;
        if (!completionMutationRef.current.has(taskId)) {
            completionConfirmedStateRef.current.set(taskId, wasCompleted);
        }
        completionRequestIdRef.current.set(taskId, requestId);

        if (task && nextTaskOrder) {
            const optimisticTasks = allTasksRef.current.map(candidate => (
                candidate.taskId === taskId ? { ...candidate, completed } : candidate
            ));
            allTasksRef.current = reorderTaskSnapshot(optimisticTasks, nextTaskOrder);
            updateTasksInState([{ taskId, updates: { completed } }], nextTaskOrder);
        }
        if (!wasCompleted) {
            celebrateStatLogged(completionOrigin ?? anchorEl);
            playAudioFeedback('taskCompleted');
        }
        const orderRevision = manualTaskOrderRevisionRef.current;
        const persist = async () => {
            try {
                const updatedTask = await taskService.toggleTaskCompletion(
                    taskId,
                    task ? completed : undefined,
                    { notifyResource: !task },
                );
                completionConfirmedStateRef.current.set(taskId, updatedTask.completed);
                if (completionRequestIdRef.current.get(taskId) === requestId) {
                    const currentTask = allTasksRef.current.find(candidate => candidate.taskId === taskId);
                    if (currentTask) {
                        allTasksRef.current = allTasksRef.current.map(candidate => (
                            candidate.taskId === taskId
                                ? { ...candidate, completed: updatedTask.completed,
                                    completionDateTime: updatedTask.completionDateTime }
                                : candidate
                        ));
                        updateTasksInState([{
                            taskId,
                            updates: {
                                completed: updatedTask.completed,
                                completionDateTime: updatedTask.completionDateTime,
                            },
                        }]);
                    }
                }
                if (nextTaskOrder && nextTaskOrder !== previousTaskOrder && updatedTask.completed !== wasCompleted
                    && orderRevision === manualTaskOrderRevisionRef.current) {
                    await saveTaskOrder(nextTaskOrder, orderRevision);
                }
                if (!wasCompleted && updatedTask.completed) {
                    showUndoFeedback('Task completed', async () => {
                        try {
                            const restoreOrderRevision = manualTaskOrderRevisionRef.current;
                            const currentOrder = allTasksRef.current.map(item => item.taskId);
                            const restoredOrder = reorderTaskIdsForCompletion(
                                currentOrder,
                                taskId,
                                false,
                                allTasksRef.current,
                                completionGroupTaskIdsByTaskIdRef.current,
                            );
                            const restoredTask = await taskService.updateTask(
                                taskId,
                                { completed: wasCompleted },
                                { notifyResource: false },
                            );
                            captureHomeTaskLayout();
                            allTasksRef.current = reorderTaskSnapshot(
                                allTasksRef.current.map(item => item.taskId === taskId
                                    ? { ...item, completed: wasCompleted,
                                        completionDateTime: restoredTask.completionDateTime }
                                    : item),
                                restoreOrderRevision === manualTaskOrderRevisionRef.current
                                    ? restoredOrder
                                    : allTasksRef.current.map(item => item.taskId),
                            );
                            updateTasksInState([{
                                taskId,
                                updates: {
                                    completed: wasCompleted,
                                    completionDateTime: restoredTask.completionDateTime,
                                },
                            }], restoreOrderRevision === manualTaskOrderRevisionRef.current
                                ? restoredOrder
                                : undefined);
                            if (restoredOrder !== currentOrder
                                && restoreOrderRevision === manualTaskOrderRevisionRef.current) {
                                await saveTaskOrder(restoredOrder, restoreOrderRevision);
                            }
                        } catch (error) {
                            console.error('Error undoing task completion:', error);
                            await refreshTaskBuckets(true);
                        }
                    });
                }
            } catch (error) {
                console.error('Error toggling task:', error);
                if (completionRequestIdRef.current.get(taskId) === requestId) {
                    const rollbackCompleted = completionConfirmedStateRef.current.get(taskId) ?? wasCompleted;
                    const currentTasks = allTasksRef.current.map(candidate => (
                        candidate.taskId === taskId
                            ? { ...candidate, completed: rollbackCompleted }
                            : candidate
                    ));
                    const rollbackOrder = nextTaskOrder
                        && orderRevision === manualTaskOrderRevisionRef.current
                        ? reorderTaskIdsForCompletion(
                            currentTasks.map(candidate => candidate.taskId),
                            taskId,
                            rollbackCompleted,
                            currentTasks,
                            completionGroupTaskIdsByTaskIdRef.current,
                        )
                        : undefined;
                    captureHomeTaskLayout();
                    allTasksRef.current = rollbackOrder
                        ? reorderTaskSnapshot(currentTasks, rollbackOrder)
                        : currentTasks;
                    updateTasksInState([{ taskId, updates: { completed: rollbackCompleted } }], rollbackOrder);
                }
            }

        };

        const queuedMutation = (completionMutationRef.current.get(taskId) ?? Promise.resolve())
            .then(persist, persist);
        completionMutationRef.current.set(taskId, queuedMutation);
        void queuedMutation.finally(() => {
            if (completionMutationRef.current.get(taskId) === queuedMutation) {
                completionMutationRef.current.delete(taskId);
                completionConfirmedStateRef.current.delete(taskId);
            }
        });
    }, [captureHomeTaskLayout, refreshTaskBuckets, saveTaskOrder, showUndoFeedback, updateTasksInState]);

    function removeTasksFromGroups(taskIds: string[]) {
        const taskIdSet = new Set(taskIds);
        setGroups(previous => (previous ?? [])
            .map(group => ({
                ...group,
                taskIds: group.taskIds.filter(taskId => !taskIdSet.has(taskId)),
            }))
            .filter(group => group.taskIds.length >= 2));
    }

    const deleteTask = useCallback((task: Task, anchorEl: HTMLElement) => {
        setDeleteRequest({ kind: 'single', tasks: [task], anchorEl });
    }, []);

    function requestGroupDelete(group: TaskGroup, anchorEl: HTMLElement) {
        if (deleteSubmitting || group.isStatGroup) return;

        setDeleteRequest({
            kind: 'group',
            group,
            tasks: allTasks.filter(task => group.taskIds.includes(task.taskId)),
            anchorEl,
        });
    }

    function requestBulkDelete(anchorEl: HTMLElement) {
        if (bulkActionLoading || selectedTasks.length === 0) return;
        setDeleteRequest({ kind: 'bulk', tasks: selectedTasks, anchorEl });
    }

    function closeDeleteRequest() {
        if (!deleteSubmitting) setDeleteRequest(null);
    }

    function confirmDelete(scope: DeleteScope = 'occurrence') {
        if (!deleteRequest || deleteSubmitting) return;

        const request = deleteRequest;
        if (request.kind === 'group' && request.group.isStatGroup) return;
        const tasksToDelete = tasksForDeleteScope(request, scope, allTasks);
        const deletedTaskIds = new Set(tasksToDelete.map(task => task.taskId));
        const deletedActivePomodoroTaskId = activePomodoroTaskIdRef.current
            && tasksToDelete.some(task => task.taskId === activePomodoroTaskIdRef.current)
            ? activePomodoroTaskIdRef.current
            : null;
        const previousGroups = groups ?? [];
        const previousCollapsedGroupIds = new Set(collapsedGroupIds);
        const previousTaskOrder = allTasks.map(task => task.taskId);
        setDeleteRequest(null);
        setDeleteSubmitting(true);
        taskService.markTasksDeleted([...deletedTaskIds]);
        setPendingDeletedTaskIds(previous => [
            ...new Set([...previous, ...deletedTaskIds]),
        ]);

        if (request.kind === 'group') {
            tasksToDelete.forEach(task => removeTaskFromState(task.taskId));
            setGroups(previous => (previous ?? []).filter(group => group.groupId !== request.group.groupId));
            setCollapsedGroupIds(previous => {
                const next = new Set(previous);
                next.delete(request.group.groupId);
                return next;
            });
        } else {
            tasksToDelete.forEach(task => removeTaskFromState(task.taskId));
            removeTasksFromGroups(tasksToDelete.map(task => task.taskId));
        }
        clearSelection();

        const restoreDeletedTasks = () => {
            taskService.restoreTasks([...deletedTaskIds]);
            setPendingDeletedTaskIds(previous => previous.filter(taskId => !deletedTaskIds.has(taskId)));
            tasksToDelete.forEach(task => addTaskToState(task));
            reorderTasksInState([...previousTaskOrder, ...tasksToDelete.map(task => task.taskId)]);
            setGroups(previousGroups);
            setCollapsedGroupIds(previousCollapsedGroupIds);
        };
        const message = scope === 'future'
            ? 'Future task occurrences deleted'
            : request.kind === 'group'
            ? 'Group deleted'
            : request.kind === 'bulk'
                ? `${request.tasks.length} tasks deleted`
                : scope === 'series' ? 'Task series deleted' : 'Task deleted';

        void (async () => {
            const receipts: Array<TaskDeletionReceipt | null> = [];
            try {
                if (request.kind === 'group') {
                    receipts.push(await taskGroupService.deleteGroup(request.group.groupId));
                }
                const operationTasks = scope === 'future'
                    ? [...new Map([...request.tasks, ...tasksToDelete].map(task => [task.taskId, task])).values()]
                    : tasksToDelete;
                receipts.push(await deleteTasksForScope(operationTasks, scope));
                const receipt = mergeTaskDeletionReceipts(receipts);
                const activeTaskIdToRefresh = activePomodoro?.active
                    ? activePomodoro.associatedTaskId
                    : deletedActivePomodoroTaskId;
                const deletedPomodoroTaskId = activeTaskIdToRefresh
                    && (receipt?.taskIds.includes(activeTaskIdToRefresh)
                        || (!receipt && deletedTaskIds.has(activeTaskIdToRefresh)))
                    ? activeTaskIdToRefresh
                    : null;
                if (deletedPomodoroTaskId) {
                    handlePomodoroActiveChange(deletedPomodoroTaskId, false, { animate: false });
                    void refreshActivePomodoro(true)
                        .catch(refreshError => console.error(
                            'Could not refresh the active Pomodoro after task deletion:', refreshError,
                        ));
                }
                setPendingDeletedTaskIds(previous => previous.filter(taskId => !deletedTaskIds.has(taskId)));
                taskGroupService.clearCache();
                void refreshGroups().catch(refreshError => console.error(
                    'Could not refresh task groups after deletion:', refreshError,
                ));
                invalidateResource('tasks');
                if (receipt) {
                    showUndoFeedback(message, async () => {
                        await taskService.restoreTaskDeletion(receipt, { notifyResource: false });
                        restoreDeletedTasks();
                        void refreshActivePomodoro(true)
                            .catch(refreshError => console.error(
                                'Could not refresh the active Pomodoro after undo:', refreshError,
                            ));
                        taskGroupService.clearCache();
                        void Promise.allSettled([refreshTaskBuckets(true), refreshGroups()]);
                        invalidateResource('tasks');
                    }, () => {}, 'success');
                } else {
                    showTaskFeedback('success', message);
                }
            } catch (err) {
                console.error(`Error deleting ${request.kind === 'group' ? 'group' : request.kind === 'bulk' ? 'selected tasks' : 'task'}:`, err);
                let rollbackSucceeded = true;
                const restorableReceipts = receipts.filter(
                    (receipt): receipt is TaskDeletionReceipt => receipt !== null,
                );
                if (restorableReceipts.length > 0) {
                    try {
                        const restorableReceipt = mergeTaskDeletionReceipts(restorableReceipts);
                        if (restorableReceipt) {
                            await taskService.restoreTaskDeletion(restorableReceipt, { notifyResource: false });
                        }
                    } catch (restoreError) {
                        rollbackSucceeded = false;
                        console.error('Could not restore task data after a failed deletion:', restoreError);
                    }
                } else {
                    taskService.restoreTasks([...deletedTaskIds]);
                }
                if (rollbackSucceeded) {
                    restoreDeletedTasks();
                } else {
                    setPendingDeletedTaskIds(previous => previous.filter(taskId => !deletedTaskIds.has(taskId)));
                    taskService.markTasksDeleted([...deletedTaskIds]);
                }
                void Promise.allSettled([refreshTaskBuckets(true), refreshGroups()]);
                showTaskFeedback('error', 'Could not delete the selected task data');
            } finally {
                setDeleteSubmitting(false);
            }
        })();
    }

    async function performBulkAction(action: BulkAction, scheduledDateTime?: string) {
        const tasksToUpdate = action === 'move-to-today' ? selectedOlderTasks : selectedTasks;
        if (action === 'move-to-date' && !scheduledDateTime) return;
        if (bulkActionLoading || tasksToUpdate.length === 0) return;
        const tasksToCelebrate = action === 'complete'
            ? tasksToUpdate.filter(task => !task.completed)
            : [];
        const tasksToReopen = action === 'reopen'
            ? tasksToUpdate.filter(task => task.completed)
            : [];
        const completionOrigins = tasksToCelebrate
            .flatMap(task => Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
                .filter(row => row.dataset.taskId === task.taskId)
                .map(row => row.getBoundingClientRect()));
        const previousCompletion = new Map(tasksToUpdate.map(task => [task.taskId, task.completed]));
        const orderRevision = manualTaskOrderRevisionRef.current;

        setBulkActionLoading(true);
        if (action === 'complete' && tasksToCelebrate.length > 0) {
            completionOrigins.forEach(origin => celebrateStatLogged(origin));
            playAudioFeedback('taskCompleted');
        }
        try {
            const updatedTasks = await Promise.all(tasksToUpdate.map(task => {
                if (action === 'move-to-today') {
                    return taskService.updateTask(task.taskId, {
                        scheduledPerformDateTime: moveTaskDateToToday(task),
                    }, { notifyResource: false });
                }

                if (action === 'move-to-date') {
                    return taskService.updateTask(task.taskId, {
                        scheduledPerformDateTime: scheduledDateTime,
                    }, { notifyResource: false });
                }

                if (action === 'clear-date') {
                    return taskService.updateTask(task.taskId, {
                        scheduledPerformDateTime: '',
                    }, { notifyResource: false });
                }

                return taskService.updateTask(
                    task.taskId,
                    { completed: action === 'complete' },
                    { notifyResource: action !== 'complete' && action !== 'reopen' },
                );
            }));
            const tasksToMove = action === 'complete' ? tasksToCelebrate : tasksToReopen;
            let nextTaskOrder: string[] | undefined;
            if (tasksToMove.length > 0 && orderRevision === manualTaskOrderRevisionRef.current) {
                const currentTaskOrder = allTasks.map(task => task.taskId);
                const reorderedTaskIds = reorderTaskIdsForCompletionChanges(
                    currentTaskOrder,
                    tasksToMove.map(task => ({
                        taskId: task.taskId,
                        completed: action === 'complete',
                    })),
                    allTasks,
                    completionGroupTaskIdsByTaskIdRef.current,
                );
                if (reorderedTaskIds !== currentTaskOrder) nextTaskOrder = reorderedTaskIds;
            }
            if (tasksToMove.length > 0) captureHomeTaskLayout();
            updateTasksInState(updatedTasks.map(updatedTask => ({
                taskId: updatedTask.taskId,
                updates: updatedTask,
            })), nextTaskOrder);
            if (nextTaskOrder) {
                await saveTaskOrder(nextTaskOrder, orderRevision);
            }
            if (action === 'move-to-date' && scheduledDateTime && isSameLocalDay(new Date(scheduledDateTime), new Date())) {
                await appendTasksToTodayOrder(
                    tasksToUpdate.filter(task => !isScheduledForToday(task)).map(task => task.taskId),
                );
            }
            if (action === 'complete' && tasksToCelebrate.length > 0) {
                showUndoFeedback(
                    `${tasksToCelebrate.length} task${tasksToCelebrate.length === 1 ? '' : 's'} completed`,
                    async () => {
                        try {
                            const reopenedIds = new Set(tasksToUpdate
                                .filter(task => !previousCompletion.get(task.taskId))
                                .map(task => task.taskId));
                            const reopenedOrderRevision = manualTaskOrderRevisionRef.current;
                            const currentOrder = allTasksRef.current.map(task => task.taskId);
                            const reopenedOrder = reorderTaskIdsForCompletionChanges(
                                currentOrder,
                                [...reopenedIds].map(taskId => ({ taskId, completed: false })),
                                allTasksRef.current,
                                completionGroupTaskIdsByTaskIdRef.current,
                            );
                            const restoredTasks = await Promise.all(tasksToUpdate.map(task =>
                                taskService.updateTask(task.taskId, {
                                    completed: previousCompletion.get(task.taskId) ?? task.completed,
                                }, { notifyResource: false }),
                            ));
                            if (reopenedIds.size > 0) captureHomeTaskLayout();
                            const restoredChanges = restoredTasks.map(restoredTask => ({
                                taskId: restoredTask.taskId,
                                updates: restoredTask,
                            }));
                            if (reopenedIds.size > 0 && reopenedOrder !== currentOrder
                                && reopenedOrderRevision === manualTaskOrderRevisionRef.current) {
                                updateTasksInState(restoredChanges, reopenedOrder);
                                await saveTaskOrder(reopenedOrder, reopenedOrderRevision);
                            } else {
                                updateTasksInState(restoredChanges);
                            }
                        } catch (error) {
                            console.error('Error undoing bulk task completion:', error);
                            await refreshTaskBuckets(true);
                        }
                    },
                );
            }
            setBulkDateAnchorEl(null);
            clearSelection();
        } catch (err) {
            console.error(`Error applying bulk task action (${action}):`, err);
            await refreshTaskBuckets(true);
        } finally {
            setBulkActionLoading(false);
        }
    }

    function toggleOlderTasks() {
        completionCardExpansionRef.current = false;
        setShowOlderTasks(previous => !previous);
        if (showOlderTasks) {
            const olderTaskIds = new Set(olderTasks.map(task => task.taskId));
            setSelectedTaskIds(previous => previous.filter(taskId => !olderTaskIds.has(taskId)));
        }
    }

    const handleTogglePanel = useCallback((taskId: string, panel: 'pomodoro' | 'details') => {
        setActiveExpansion(previous =>
            previous?.taskId === taskId && previous?.panel === panel ? null : { taskId, panel },
        );
    }, []);

    useEffect(() => {
        const taskId = activeExpansion?.taskId;
        if (!taskId) return undefined;

        const timeoutId = window.setTimeout(() => {
            const taskRow = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
                .find(row => row.dataset.taskId === taskId);
            if (!taskRow) return;

            const bounds = taskRow.getBoundingClientRect();
            if (bounds.top < 16 || bounds.bottom > window.innerHeight - 16) {
                taskRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 360);

        return () => window.clearTimeout(timeoutId);
    }, [activeExpansion?.taskId]);

    const handleAutoExpand = useCallback((taskId: string, panel: 'pomodoro') => {
        setActiveExpansion(previous => previous ?? { taskId, panel });
    }, []);

    const applySelection = useCallback((taskIds: string[], groupIds: string[]) => {
        const nextTaskIds = new Set(taskIds);
        const nextGroupIds = new Set(groupIds);

        selectableGroups.forEach(group => {
            if (nextGroupIds.has(group.groupId)) {
                group.taskIds.forEach(taskId => nextTaskIds.delete(taskId));
            } else if (group.taskIds.length > 1 && group.taskIds.every(taskId => nextTaskIds.has(taskId))) {
                nextGroupIds.add(group.groupId);
                group.taskIds.forEach(taskId => nextTaskIds.delete(taskId));
            }
        });

        setSelectedTaskIds([...nextTaskIds]);
        setSelectedGroupIds([...nextGroupIds]);
    }, [selectableGroups]);

    const handleTaskSelection = useCallback((task: Task, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        const taskId = task.taskId;
        const keepActivePomodoroOpen = activeExpansion?.panel === 'pomodoro'
            && activeExpansion.taskId === activePomodoroTaskIdRef.current;
        if (activeExpansion?.taskId && activeExpansion.taskId !== taskId && !keepActivePomodoroOpen) {
            setActiveExpansion(null);
        }
        const anchorId = selectionAnchorRef.current;

        if (event.shiftKey && anchorId) {
            const anchorIndex = renderedSelectionEntities.findIndex(entity => entity.id === anchorId);
            const taskIndex = renderedSelectionEntities.findIndex(
                entity => entity.kind === 'task' && entity.id === taskId,
            );
            if (anchorIndex !== -1 && taskIndex !== -1) {
                const rangeStart = Math.min(anchorIndex, taskIndex);
                const rangeEnd = Math.max(anchorIndex, taskIndex);
                const rangeEntities = renderedSelectionEntities.slice(rangeStart, rangeEnd + 1);
                const rangeTaskIds = rangeEntities
                    .filter((entity): entity is Extract<SelectionEntity, { kind: 'task' }> => entity.kind === 'task')
                    .map(entity => entity.id);
                const rangeGroupIds = rangeEntities
                    .filter((entity): entity is Extract<SelectionEntity, { kind: 'group' }> => entity.kind === 'group')
                    .map(entity => entity.id);
                applySelection(
                    [...new Set([...selectedTaskIds, ...rangeTaskIds])],
                    [...new Set([...selectedGroupIds, ...rangeGroupIds])],
                );
                return;
            }
        }

        if (event.ctrlKey || event.metaKey) {
            if (selectedGroupTaskIdSet.has(taskId)) {
                const selectedGroupsContainingTask = selectableGroups.filter(group =>
                    selectedGroupIds.includes(group.groupId) && group.taskIds.includes(taskId),
                );
                const expandedGroupIds = new Set(selectedGroupsContainingTask.map(group => group.groupId));
                const remainingGroupIds = selectedGroupIds.filter(groupId => !expandedGroupIds.has(groupId));
                const remainingGroupTaskIds = selectedGroupsContainingTask
                    .flatMap(group => group.taskIds.filter(groupTaskId => groupTaskId !== taskId));
                applySelection(
                    [...new Set([...selectedTaskIds, ...remainingGroupTaskIds])],
                    remainingGroupIds,
                );
                selectionAnchorRef.current = taskId;
                return;
            }
            applySelection(
                selectedTaskIds.includes(taskId)
                    ? selectedTaskIds.filter(selectedTaskId => selectedTaskId !== taskId)
                    : [...selectedTaskIds, taskId],
                selectedGroupIds,
            );
            selectionAnchorRef.current = taskId;
            return;
        }

        applySelection([taskId], []);
        selectionAnchorRef.current = taskId;
    }, [activeExpansion, applySelection, renderedSelectionEntities, selectedGroupIds, selectableGroups,
        selectedGroupTaskIdSet, selectedTaskIds]);

    const handleTaskContextMenu = useCallback((task: Task, event: React.MouseEvent<HTMLElement>) => {
        setTaskReminderEditor(null);
        setSelectedTaskIds([task.taskId]);
        setSelectedGroupIds([]);
        selectionAnchorRef.current = task.taskId;
        setTaskContextMenu({
            task,
            top: event.clientY,
            left: event.clientX,
            anchorEl: event.currentTarget,
        });
    }, []);

    const handleGroupSelection = useCallback((groupId: string, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        const anchorId = selectionAnchorRef.current;

        if (event.shiftKey && anchorId) {
            const anchorIndex = renderedSelectionEntities.findIndex(entity => entity.id === anchorId);
            const groupIndex = renderedSelectionEntities.findIndex(
                entity => entity.kind === 'group' && entity.id === groupId,
            );
            if (anchorIndex !== -1 && groupIndex !== -1) {
                const rangeEntities = renderedSelectionEntities.slice(
                    Math.min(anchorIndex, groupIndex),
                    Math.max(anchorIndex, groupIndex) + 1,
                );
                applySelection(
                    [...new Set([
                        ...selectedTaskIds,
                        ...rangeEntities.filter(entity => entity.kind === 'task').map(entity => entity.id),
                    ])],
                    [...new Set([
                        ...selectedGroupIds,
                        ...rangeEntities.filter(entity => entity.kind === 'group').map(entity => entity.id),
                    ])],
                );
                return;
            }
        }

        applySelection(
            selectedTaskIds,
            selectedGroupIds.includes(groupId)
                ? selectedGroupIds.filter(selectedGroupId => selectedGroupId !== groupId)
                : [...selectedGroupIds, groupId],
        );
        selectionAnchorRef.current = groupId;
    }, [applySelection, renderedSelectionEntities, selectedGroupIds, selectedTaskIds]);

    useEffect(() => {
        const handleTaskKeyboard = (event: KeyboardEvent) => {
            if (event.key === 'ArrowRight') {
                if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

                const target = event.target;
                if (target instanceof Element && target.closest(
                    'input, textarea, select, button, [role="button"], [contenteditable="true"]',
                )) return;

                const taskIds = renderedSelectionEntities
                    .filter((entity): entity is Extract<SelectionEntity, { kind: 'task' }> => entity.kind === 'task')
                    .map(entity => entity.id);
                const currentTaskId = selectionAnchorRef.current && taskIds.includes(selectionAnchorRef.current)
                    ? selectionAnchorRef.current
                    : selectedTaskIds[selectedTaskIds.length - 1];
                if (!currentTaskId || !taskIds.includes(currentTaskId)) return;

                event.preventDefault();
                setEditRequest(previous => ({
                    taskId: currentTaskId,
                    requestId: (previous?.requestId ?? 0) + 1,
                }));
                return;
            }

            if (event.key !== 'Tab') return;
            const target = event.target;
            const editingTaskName = target instanceof Element
                && target.closest('[data-task-name-input="true"]');
            if (target instanceof Element
                && target.closest('input, textarea, select, [contenteditable="true"]')
                && !editingTaskName) {
                return;
            }
            if (target instanceof Element && target.closest('[data-task-details="true"]')) return;

            const taskIds = renderedSelectionEntities
                .filter((entity): entity is Extract<SelectionEntity, { kind: 'task' }> => entity.kind === 'task')
                .map(entity => entity.id);
            if (taskIds.length === 0) return;

            const currentTaskId = selectionAnchorRef.current && taskIds.includes(selectionAnchorRef.current)
                ? selectionAnchorRef.current
                : selectedTaskIds[selectedTaskIds.length - 1];
            if (!event.shiftKey && activeExpansion?.panel === 'details'
                && activeExpansion.taskId === currentTaskId
                && !(target instanceof Element && target.closest('[data-task-details="true"]'))) {
                const detailsFirstControl = Array.from(
                    document.querySelectorAll<HTMLElement>('[data-task-details-first-focus="true"]'),
                ).find(control => control.closest('[data-task-id]')?.getAttribute('data-task-id') === currentTaskId);
                if (detailsFirstControl) {
                    event.preventDefault();
                    detailsFirstControl.focus();
                    return;
                }
            }
            const currentIndex = currentTaskId ? taskIds.indexOf(currentTaskId) : -1;
            const nextIndex = event.shiftKey
                ? (currentIndex <= 0 ? taskIds.length - 1 : currentIndex - 1)
                : (currentIndex + 1) % taskIds.length;

            event.preventDefault();
            if (target instanceof HTMLElement) target.blur();
            const nextTaskId = taskIds[nextIndex];
            setSelectedTaskIds([nextTaskId]);
            setSelectedGroupIds([]);
            selectionAnchorRef.current = nextTaskId;
        };

        window.addEventListener('keydown', handleTaskKeyboard);
        return () => window.removeEventListener('keydown', handleTaskKeyboard);
    }, [activeExpansion, renderedSelectionEntities, selectedTaskIds]);

    const handlePomodoroActiveChange = useCallback((
        taskId: string,
        active: boolean,
        options?: { animate?: boolean },
    ) => {
        if (active) {
            if (activePomodoroTaskIdRef.current === taskId) return;

            clearFocusTransitionTimer();
            rememberFocusTaskPosition(taskId);
            const latestStatus = latestPomodoroStatusRef.current;
            const initialStatus = latestStatus?.active && latestStatus.associatedTaskId === taskId
                ? latestStatus
                : null;
            latestPomodoroStatusRef.current = initialStatus;
            activePomodoroTaskIdRef.current = taskId;
            setActivePomodoroTaskId(taskId);
            setInitialPomodoroStatus(initialStatus);
            setPomodoroTaskMinimized(false);
            setSelectedTaskIds([]);
            setShowOlderTasks(false);
            if (options?.animate === false) {
                setFocusVisibility('hidden');
                return;
            }

            finishFocusTransition();
            return;
        }

        clearFocusTransitionTimer();
        if (activePomodoroTaskIdRef.current !== taskId) {
            setActiveExpansion(previous =>
                previous?.taskId === taskId && previous.panel === 'pomodoro' ? null : previous,
            );
            return;
        }

        if (options?.animate === true && !pomodoroTaskMinimized) {
            setFocusVisibility('returning');
            focusTransitionTimerRef.current = window.setTimeout(() => {
                const currentTop = focusedPomodoroRowRef.current?.getBoundingClientRect().top;
                const sourceTop = currentTop === undefined
                    ? focusTaskSourceTopRef.current
                    : currentTop + window.scrollY;
                if (sourceTop !== null && sourceTop !== undefined) {
                    setTaskReturnEntry({ taskId, top: sourceTop });
                }
                setActiveExpansion(previous =>
                    previous?.taskId === taskId && previous.panel === 'pomodoro' ? null : previous,
                );
                activePomodoroTaskIdRef.current = null;
                latestPomodoroStatusRef.current = null;
                setActivePomodoroTaskId(null);
                setInitialPomodoroStatus(null);
                setPomodoroTaskMinimized(false);
                setFocusVisibility('all');
                focusTransitionTimerRef.current = null;
            }, FOCUS_TASK_SLIDE_DURATION_MS);
            return;
        }

        setActiveExpansion(previous =>
            previous?.taskId === taskId && previous.panel === 'pomodoro' ? null : previous,
        );
        activePomodoroTaskIdRef.current = null;
        latestPomodoroStatusRef.current = null;
        setActivePomodoroTaskId(null);
        setInitialPomodoroStatus(null);
        setPomodoroTaskMinimized(false);
        setFocusVisibility('all');
    }, [clearFocusTransitionTimer, finishFocusTransition, pomodoroTaskMinimized, rememberFocusTaskPosition]);

    useEffect(() => {
        if (!activePomodoro?.active) return;

        const taskId = activePomodoro.associatedTaskId;
        const taskChanged = activePomodoroTaskIdRef.current !== taskId;
        latestPomodoroStatusRef.current = activePomodoro;
        if (taskChanged) {
            setInitialPomodoroStatus(activePomodoro);
            handlePomodoroActiveChange(taskId, true, { animate: false });
        }

        // Keep the timer as the default panel, but let another task's details
        // stay open while this Pomodoro continues running.
        setActiveExpansion(previous => (
            previous?.taskId === taskId
                ? previous
                : previous ?? { taskId, panel: 'pomodoro' }
        ));
    }, [activePomodoro, handlePomodoroActiveChange]);

    const handlePomodoroStatusChange = useCallback((taskId: string, status: PomodoroStatus) => {
        const activeTaskId = activePomodoroTaskIdRef.current;
        if (activeTaskId === null || activeTaskId === taskId) {
            latestPomodoroStatusRef.current = status;
            if (status.active) {
                // Preserve the first live snapshot for the focus-row remount,
                // but replace an optimistic completed snapshot if a mutation
                // is rolled back to this still-active session.
                setInitialPomodoroStatus(previous => (
                    previous?.active && previous.pomodoroId === status.pomodoroId
                        ? previous
                        : status
                ));
            } else if (status.phase === 'COMPLETED') {
                // Keep a remounted focus row from hydrating the stale active snapshot.
                setInitialPomodoroStatus(status);
                // The completion panel contains the dismiss action; do not
                // leave a finished focus row stranded behind its details.
                setActiveExpansion(previous => (
                    previous?.taskId === taskId && previous.panel === 'details'
                        ? { taskId, panel: 'pomodoro' }
                        : previous
                ));
            }
        }
    }, []);

    const showAllTasks = useCallback(() => {
        clearFocusTransitionTimer();
        setFocusVisibility('revealing');
        focusTransitionTimerRef.current = window.setTimeout(() => {
            setFocusVisibility('all');
            focusTransitionTimerRef.current = null;
        }, 260);
    }, [clearFocusTransitionTimer]);

    const hideAllTasks = useCallback(() => {
        if (!focusedPomodoroTask || tasksBelowFocus.length === 0) return;

        clearFocusTransitionTimer();
        setFocusVisibility('fading');
        focusTransitionTimerRef.current = window.setTimeout(() => {
            setShowOlderTasks(false);
            setFocusVisibility('hidden');
            focusTransitionTimerRef.current = null;
        }, TASKS_FADE_DURATION_MS);
    }, [clearFocusTransitionTimer, focusedPomodoroTask, tasksBelowFocus.length]);

    const minimizePomodoroTask = useCallback((taskId: string) => {
        if (activePomodoroTaskIdRef.current !== taskId) return;

        clearFocusTransitionTimer();
        setActiveExpansion(null);
        setPomodoroTaskMinimized(true);
        setFocusVisibility('all');
    }, [clearFocusTransitionTimer]);

    const finishDragging = useCallback(() => {
        activeDragRef.current = null;
        const temporarilyCollapsedGroupId = temporarilyCollapsedGroupIdRef.current;
        if (temporarilyCollapsedGroupId) {
            setCollapsedGroupIds(previous => {
                const next = new Set(previous);
                next.delete(temporarilyCollapsedGroupId);
                return next;
            });
            temporarilyCollapsedGroupIdRef.current = null;
        }
        setDraggedTaskIds([]);
        setDraggedTaskId(null);
        setDraggedGroupId(null);
        setDragTargetTaskId(null);
        setDragTargetGroupId(null);
        setDragTargetPosition(null);
        setDragEdge(null);
    }, []);

    const persistTaskOrder = useCallback(async (orderedTaskIds: string[], failOnError = false) => {
        const orderRevision = ++manualTaskOrderRevisionRef.current;
        reorderTasksInState(orderedTaskIds);
        await saveTaskOrder(orderedTaskIds, orderRevision, failOnError);
    }, [reorderTasksInState, saveTaskOrder]);

    const placeTasksAfterGroup = useCallback(async (targetGroup: TaskGroup, taskIds: string[]) => {
        const taskIdSet = new Set(taskIds);
        const orderedTaskIds = allTasks.map(task => task.taskId);
        const existingGroupTaskIds = orderedTaskIds.filter(taskId =>
            targetGroup.taskIds.includes(taskId) && !taskIdSet.has(taskId),
        );
        if (existingGroupTaskIds.length === 0) return;

        const orderWithoutAddedTasks = orderedTaskIds.filter(taskId => !taskIdSet.has(taskId));
        const lastGroupTaskIndex = orderWithoutAddedTasks.indexOf(
            existingGroupTaskIds[existingGroupTaskIds.length - 1],
        );
        if (lastGroupTaskIndex === -1) return;

        orderWithoutAddedTasks.splice(lastGroupTaskIndex + 1, 0, ...taskIds);
        await persistTaskOrder(orderWithoutAddedTasks, true);
    }, [allTasks, persistTaskOrder]);

    const placeTasksRelativeToTask = useCallback(async (
        targetTaskId: string,
        taskIds: string[],
        edge: DropEdge,
    ) => {
        const taskIdSet = new Set(taskIds);
        const orderWithoutAddedTasks = allTasks
            .map(task => task.taskId)
            .filter(taskId => !taskIdSet.has(taskId));
        const targetIndex = orderWithoutAddedTasks.indexOf(targetTaskId);
        if (targetIndex === -1) return;

        orderWithoutAddedTasks.splice(targetIndex + (edge === 'after' ? 1 : 0), 0, ...taskIds);
        await persistTaskOrder(orderWithoutAddedTasks, true);
    }, [allTasks, persistTaskOrder]);

    const appendTasksToTodayOrder = useCallback(async (taskIds: string[]) => {
        const movedTaskIdSet = new Set(taskIds);
        const movedTaskIds = allTasks
            .map(task => task.taskId)
            .filter(taskId => movedTaskIdSet.has(taskId));
        if (movedTaskIds.length === 0) return;

        const orderWithoutMovedTasks = allTasks
            .map(task => task.taskId)
            .filter(taskId => !movedTaskIdSet.has(taskId));
        const todayTaskIdSet = new Set(todayTasks.map(task => task.taskId));
        let lastTodayIndex = -1;
        orderWithoutMovedTasks.forEach((taskId, index) => {
            if (todayTaskIdSet.has(taskId)) lastTodayIndex = index;
        });

        if (lastTodayIndex === -1) {
            orderWithoutMovedTasks.push(...movedTaskIds);
        } else {
            orderWithoutMovedTasks.splice(lastTodayIndex + 1, 0, ...movedTaskIds);
        }
        await persistTaskOrder(orderWithoutMovedTasks);
    }, [allTasks, persistTaskOrder, todayTasks]);

    const getTaskOrderInToday = useCallback((taskIds: string[], placement: TodayDropPlacement) => {
        const movedTaskIdSet = new Set(taskIds);
        const currentTasks = allTasksRef.current;
        const movedTaskIds = currentTasks
            .map(task => task.taskId)
            .filter(taskId => movedTaskIdSet.has(taskId));
        if (movedTaskIds.length === 0) return null;

        const orderWithoutMovedTasks = currentTasks
            .map(task => task.taskId)
            .filter(taskId => !movedTaskIdSet.has(taskId));
        const todayTaskIdSet = new Set(todayTasks.map(task => task.taskId));
        const visibleTodayTaskIdSet = new Set(visibleTasks.map(task => task.taskId));
        let insertionIndex = orderWithoutMovedTasks.length;

        if (placement.kind === 'task') {
            const targetIndex = orderWithoutMovedTasks.indexOf(placement.targetTaskId);
            if (targetIndex !== -1) {
                insertionIndex = targetIndex + (placement.edge === 'after' ? 1 : 0);
            }
        } else if (placement.kind === 'group') {
            const targetGroupTaskIds = orderWithoutMovedTasks.filter(taskId =>
                placement.targetGroup.taskIds.includes(taskId),
            );
            if (targetGroupTaskIds.length > 0) {
                const anchorTaskId = placement.edge === 'before'
                    ? targetGroupTaskIds[0]
                    : targetGroupTaskIds[targetGroupTaskIds.length - 1];
                insertionIndex = orderWithoutMovedTasks.indexOf(anchorTaskId)
                    + (placement.edge === 'after' ? 1 : 0);
            }
        } else {
            const todayTaskIds = orderWithoutMovedTasks.filter(taskId =>
                (visibleTodayTaskIdSet.size > 0 ? visibleTodayTaskIdSet : todayTaskIdSet).has(taskId),
            );
            if (todayTaskIds.length > 0) {
                const anchorTaskId = placement.edge === 'top'
                    ? todayTaskIds[0]
                    : todayTaskIds[todayTaskIds.length - 1];
                insertionIndex = orderWithoutMovedTasks.indexOf(anchorTaskId)
                    + (placement.edge === 'bottom' ? 1 : 0);
            }
        }

        orderWithoutMovedTasks.splice(insertionIndex, 0, ...movedTaskIds);
        return orderWithoutMovedTasks;
    }, [todayTasks, visibleTasks]);

    const moveTasksToToday = useCallback(async (
        taskIds: string[],
        placement?: TodayDropPlacement,
    ) => {
        const olderTaskIdSet = new Set(olderTasks.map(task => task.taskId));
        const tasksToMove = allTasks.filter(task => taskIds.includes(task.taskId) && olderTaskIdSet.has(task.taskId));
        if (tasksToMove.length === 0) return false;

        const updates = tasksToMove.map(task => ({
            task,
            scheduledPerformDateTime: moveTaskDateToToday(task),
        }));
        const movedTaskIds = tasksToMove.map(task => task.taskId);
        const orderedTaskIds = placement
            ? getTaskOrderInToday(movedTaskIds, placement)
            : null;
        const orderRevision = orderedTaskIds ? ++manualTaskOrderRevisionRef.current : null;
        const dateByTaskId = new Map(updates.map(update => [update.task.taskId, update.scheduledPerformDateTime]));
        const optimisticTasks = allTasksRef.current.map(task => {
            const scheduledPerformDateTime = dateByTaskId.get(task.taskId);
            return scheduledPerformDateTime !== undefined
                ? { ...task, scheduledPerformDateTime }
                : task;
        });
        allTasksRef.current = orderedTaskIds
            ? reorderTaskSnapshot(optimisticTasks, orderedTaskIds)
            : optimisticTasks;
        updateTasksInState(updates.map(({ task, scheduledPerformDateTime }) => ({
            taskId: task.taskId,
            updates: { scheduledPerformDateTime },
        })), orderedTaskIds ?? undefined);

        try {
            const updatedTasks = await Promise.all(updates.map(({ task, scheduledPerformDateTime }) =>
                taskService.updateTask(task.taskId, { scheduledPerformDateTime }, { notifyResource: false }),
            ));
            updateTasksInState(updatedTasks.map(updatedTask => ({
                taskId: updatedTask.taskId,
                updates: updatedTask,
            })));
            // The reorder endpoint saves full task rows, so let the date PATCHes commit first.
            if (orderedTaskIds && orderRevision === manualTaskOrderRevisionRef.current) {
                await saveTaskOrder(orderedTaskIds, orderRevision);
            }
            return true;
        } catch (err) {
            console.error('Error moving dragged tasks to today:', err);
            await refreshTaskBuckets(true);
            return false;
        }
    }, [allTasks, getTaskOrderInToday, olderTasks, refreshTaskBuckets, saveTaskOrder, updateTasksInState]);

    const moveGroupToToday = useCallback(async (group: TaskGroup, placement?: TodayDropPlacement) => {
        const groupTaskIdSet = new Set(group.taskIds);
        const tasksToMove = allTasks.filter(task => groupTaskIdSet.has(task.taskId));
        if (tasksToMove.length === 0) return;

        const updates = tasksToMove.map(task => ({
            task,
            scheduledPerformDateTime: moveTaskDateToToday(task),
        }));
        const movedTaskIds = tasksToMove.map(task => task.taskId);
        const orderedTaskIds = placement
            ? getTaskOrderInToday(movedTaskIds, placement)
            : null;
        const orderRevision = orderedTaskIds ? ++manualTaskOrderRevisionRef.current : null;
        const dateByTaskId = new Map(updates.map(update => [update.task.taskId, update.scheduledPerformDateTime]));
        const optimisticTasks = allTasksRef.current.map(task => {
            const scheduledPerformDateTime = dateByTaskId.get(task.taskId);
            return scheduledPerformDateTime !== undefined
                ? { ...task, scheduledPerformDateTime }
                : task;
        });
        allTasksRef.current = orderedTaskIds
            ? reorderTaskSnapshot(optimisticTasks, orderedTaskIds)
            : optimisticTasks;
        updateTasksInState(updates.map(({ task, scheduledPerformDateTime }) => ({
            taskId: task.taskId,
            updates: { scheduledPerformDateTime },
        })), orderedTaskIds ?? undefined);
        try {
            const updatedTasks = await Promise.all(updates.map(({ task, scheduledPerformDateTime }) =>
                taskService.updateTask(
                    task.taskId,
                    { scheduledPerformDateTime },
                    { notifyResource: false },
                ),
            ));
            updateTasksInState(updatedTasks.map(updatedTask => ({
                taskId: updatedTask.taskId,
                updates: updatedTask,
            })));
            if (orderedTaskIds && orderRevision === manualTaskOrderRevisionRef.current) {
                await saveTaskOrder(orderedTaskIds, orderRevision);
            }
        } catch (err) {
            console.error('Error moving task group to today:', err);
            await refreshTaskBuckets(true);
        }
    }, [allTasks, getTaskOrderInToday, refreshTaskBuckets, saveTaskOrder, updateTasksInState]);

    const moveDraggedGroupToToday = useCallback((placement?: TodayDropPlacement) => {
        const draggedGroupId = getDraggedGroupId();
        const draggedGroup = groups?.find(group => group.groupId === draggedGroupId);
        const olderTaskIdSet = new Set(olderTasks.map(task => task.taskId));
        if (!draggedGroup || !draggedGroup.taskIds.some(taskId => olderTaskIdSet.has(taskId))) {
            return false;
        }

        void moveGroupToToday(draggedGroup, placement);
        finishDragging();
        return true;
    }, [finishDragging, getDraggedGroupId, groups, moveGroupToToday, olderTasks]);

    const moveDraggedOlderTasksToToday = useCallback((placement?: TodayDropPlacement) => {
        const draggedIds = getDraggedTaskIds();
        const olderTaskIdSet = new Set(olderTasks.map(task => task.taskId));
        const draggedOlderTaskIds = draggedIds.filter(taskId => olderTaskIdSet.has(taskId));
        if (draggedOlderTaskIds.length === 0) return false;

        void moveTasksToToday(draggedOlderTaskIds, placement);
        finishDragging();
        return true;
    }, [finishDragging, getDraggedTaskIds, moveTasksToToday, olderTasks]);

    const applyUpdatedGroup = useCallback((updatedGroup: TaskGroup, movedTaskIds: string[]) => {
        const movedTaskIdSet = new Set(movedTaskIds);
        setGroups(previous => {
            if (!previous) return previous;

            const next = previous
                .map(group => {
                    if (group.groupId === updatedGroup.groupId) {
                        return sameTaskGroup(group, updatedGroup) ? group : updatedGroup;
                    }

                    const nextTaskIds = group.taskIds.filter(taskId => !movedTaskIdSet.has(taskId));
                    return nextTaskIds.length === group.taskIds.length
                        ? group
                        : { ...group, taskIds: nextTaskIds };
                })
                .filter(group => group.taskIds.length >= 2);

            return next.length === previous.length
                && next.every((group, index) => group === previous[index])
                ? previous
                : next;
        });
    }, []);

    const createGroupFromTaskDrop = useCallback(async (targetTask: Task, taskIds: string[]) => {
        const groupedTaskIds = [...new Set([targetTask.taskId, ...taskIds])];
        if (groupedTaskIds.length < 2) return;

        try {
            const groupName = targetTask.name.trim().slice(0, 120) || 'Task group';
            const createdGroup = await taskGroupService.createGroup(groupName, groupedTaskIds);
            const groupedTaskIdSet = new Set(groupedTaskIds);
            setGroups(previous => [
                ...(previous ?? [])
                    .map(group => ({
                        ...group,
                        taskIds: group.taskIds.filter(taskId => !groupedTaskIdSet.has(taskId)),
                    }))
                    .filter(group => group.taskIds.length >= 2),
                createdGroup,
            ]);
        } catch (err) {
            console.error('Error creating task group from drag:', err);
            await refreshGroups();
        }
    }, [refreshGroups]);

    const groupTasksFromDrop = useCallback(async (targetTask: Task, taskIds: string[]) => {
        const groupedTaskIds = [...new Set([targetTask.taskId, ...taskIds])];
        const olderTaskIds = groupedTaskIds.filter(taskId => olderTaskIdSet.has(taskId));
        if (olderTaskIds.length > 0 && !(await moveTasksToToday(olderTaskIds))) return;

        await createGroupFromTaskDrop(targetTask, taskIds);
    }, [createGroupFromTaskDrop, moveTasksToToday, olderTaskIdSet]);

    const addTasksToGroup = useCallback(async (
        targetGroup: TaskGroup,
        taskIds: string[],
        placement?: GroupTaskDropPlacement,
    ) => {
        const taskIdsToAdd = taskIds.filter(taskId => !targetGroup.taskIds.includes(taskId));
        if (targetGroup.isStatGroup || targetGroup.linkedToMentalThread || taskIdsToAdd.length === 0) return;

        minimizePomodoroTask(taskIdsToAdd[0]);
        const nextTaskIds = [...targetGroup.taskIds];
        if (placement) {
            const targetIndex = nextTaskIds.indexOf(placement.targetTaskId);
            if (targetIndex === -1) {
                nextTaskIds.push(...taskIdsToAdd);
            } else {
                nextTaskIds.splice(targetIndex + (placement.edge === 'after' ? 1 : 0), 0, ...taskIdsToAdd);
            }
        } else {
            nextTaskIds.push(...taskIdsToAdd);
        }
        const taskOrderPromise = placement
            ? placeTasksRelativeToTask(placement.targetTaskId, taskIdsToAdd, placement.edge)
            : placeTasksAfterGroup(targetGroup, taskIdsToAdd);
        applyUpdatedGroup({
            ...targetGroup,
            taskIds: nextTaskIds,
        }, taskIdsToAdd);

        try {
            await taskOrderPromise;
            const updatedGroup = await taskGroupService.replaceTasks(
                targetGroup.groupId,
                nextTaskIds,
            );
            applyUpdatedGroup(updatedGroup, taskIdsToAdd);
        } catch (err) {
            console.error('Error adding task to group:', err);
            await refreshGroups();
        }
    }, [applyUpdatedGroup, minimizePomodoroTask, placeTasksAfterGroup, placeTasksRelativeToTask, refreshGroups]);

    const removeTasksFromGroup = useCallback(async (sourceGroup: TaskGroup, taskIds: string[]) => {
        if (sourceGroup.isStatGroup) return;
        const taskIdsInGroup = taskIds.filter(taskId => sourceGroup.taskIds.includes(taskId));
        if (taskIdsInGroup.length === 0) return;

        const remainingTaskIds = sourceGroup.taskIds.filter(taskId => !taskIdsInGroup.includes(taskId));
        try {
            if (remainingTaskIds.length >= 2) {
                await taskGroupService.replaceTasks(sourceGroup.groupId, remainingTaskIds);
            } else {
                await taskGroupService.deleteGroup(sourceGroup.groupId);
            }
            setGroups(previous => remainingTaskIds.length >= 2
                ? (previous ?? []).map(group => group.groupId === sourceGroup.groupId
                    ? { ...group, taskIds: remainingTaskIds }
                    : group)
                : (previous ?? []).filter(group => group.groupId !== sourceGroup.groupId));
        } catch (err) {
            console.error('Error removing dragged tasks from group:', err);
            await refreshGroups();
        }
    }, [refreshGroups]);

    const reorderGroupRelativeToTask = useCallback((groupId: string, targetTaskId: string, edge: DropEdge) => {
        const group = groups?.find(candidate => candidate.groupId === groupId);
        if (!group || group.taskIds.includes(targetTaskId)) return;

        const visibleTaskIds = visibleTasks.map(task => task.taskId);
        const visibleGroupTaskIds = visibleTaskIds.filter(taskId => group.taskIds.includes(taskId));
        if (visibleGroupTaskIds.length === 0) return;

        const groupTaskIdSet = new Set(visibleGroupTaskIds);
        const orderWithoutGroup = visibleTaskIds.filter(taskId => !groupTaskIdSet.has(taskId));
        const targetIndex = orderWithoutGroup.indexOf(targetTaskId);
        if (targetIndex === -1) return;

        orderWithoutGroup.splice(targetIndex + (edge === 'after' ? 1 : 0), 0, ...visibleGroupTaskIds);
        persistTaskOrder(orderWithoutGroup);
    }, [groups, persistTaskOrder, visibleTasks]);

    const handleDropOnTask = useCallback((targetTask: Task, edge: DropEdge) => {
        if (moveDraggedGroupToToday({ kind: 'task', targetTaskId: targetTask.taskId, edge })) return;
        if (moveDraggedOlderTasksToToday({ kind: 'task', targetTaskId: targetTask.taskId, edge })) return;

        const activeGroupId = getDraggedGroupId();
        if (activeGroupId) {
            reorderGroupRelativeToTask(activeGroupId, targetTask.taskId, edge);
            finishDragging();
            return;
        }

        const draggedIds = getDraggedTaskIds();
        if (draggedIds.length === 0 || draggedIds.includes(targetTask.taskId)) {
            finishDragging();
            return;
        }

        const draggedIdSet = new Set(draggedIds);
        const targetGroup = groups?.find(group => group.taskIds.includes(targetTask.taskId));
        const orderedTaskIds = visibleTasks.map(task => task.taskId);
        const movedTaskIds = orderedTaskIds.filter(taskId => draggedIdSet.has(taskId));
        if (movedTaskIds.length === 0 || !orderedTaskIds.includes(targetTask.taskId)) return;

        const orderWithoutMovedTasks = orderedTaskIds.filter(taskId => !draggedIdSet.has(taskId));
        const targetIndex = orderWithoutMovedTasks.indexOf(targetTask.taskId);
        orderWithoutMovedTasks.splice(targetIndex + (edge === 'after' ? 1 : 0), 0, ...movedTaskIds);
        minimizePomodoroTask(getPrimaryDraggedTaskId() ?? movedTaskIds[0]);
        persistTaskOrder(orderWithoutMovedTasks);

        const sourceGroups = (groups ?? []).filter(group =>
            group.groupId !== targetGroup?.groupId
            && !getDraggedPreservedGroupIds().includes(group.groupId)
            && movedTaskIds.some(taskId => group.taskIds.includes(taskId)),
        );
        sourceGroups.forEach(sourceGroup => {
            void removeTasksFromGroup(sourceGroup, movedTaskIds);
        });
    }, [finishDragging, getDraggedGroupId, getDraggedPreservedGroupIds, getDraggedTaskIds, getPrimaryDraggedTaskId, groups, minimizePomodoroTask,
        moveDraggedGroupToToday, moveDraggedOlderTasksToToday, persistTaskOrder, removeTasksFromGroup,
        reorderGroupRelativeToTask, visibleTasks]);

    const reorderRelativeToGroup = useCallback((taskIds: string[], targetGroup: TaskGroup, edge: DropEdge) => {
        const orderedTaskIds = visibleTasks.map(task => task.taskId);
        const movedTaskIdSet = new Set(taskIds);
        const orderWithoutMovedTasks = orderedTaskIds.filter(taskId => !movedTaskIdSet.has(taskId));
        const targetGroupTaskIds = orderWithoutMovedTasks.filter(taskId => targetGroup.taskIds.includes(taskId));
        if (targetGroupTaskIds.length === 0) return;

        const anchorTaskId = edge === 'before'
            ? targetGroupTaskIds[0]
            : targetGroupTaskIds[targetGroupTaskIds.length - 1];
        const anchorIndex = orderWithoutMovedTasks.indexOf(anchorTaskId);
        orderWithoutMovedTasks.splice(anchorIndex + (edge === 'after' ? 1 : 0), 0, ...taskIds);
        persistTaskOrder(orderWithoutMovedTasks);
    }, [persistTaskOrder, visibleTasks]);

    const handleDropOnGroup = useCallback((targetGroup: TaskGroup, intent: GroupDropIntent) => {
        const targetLinked = Boolean(targetGroup.isStatGroup || targetGroup.linkedToMentalThread);
        const draggedIds = getDraggedTaskIds();
        if (intent === 'inside' && targetLinked) {
            finishDragging();
            return;
        }
        if (moveDraggedGroupToToday(
            intent === 'inside'
                ? undefined
                : { kind: 'group', targetGroup, edge: intent },
        )) return;
        const activeGroupId = getDraggedGroupId();
        const olderTaskIdSet = new Set(olderTasks.map(task => task.taskId));
        const draggedOlderTaskIds = draggedIds.filter(taskId => olderTaskIdSet.has(taskId));

        if (intent === 'inside') {
            if (draggedOlderTaskIds.length > 0) {
                void moveTasksToToday(draggedOlderTaskIds);
                void addTasksToGroup(targetGroup, draggedOlderTaskIds);
                finishDragging();
                return;
            }

            const taskIdsToAdd = draggedIds.filter(taskId => !targetGroup.taskIds.includes(taskId));
            if (taskIdsToAdd.length > 0) {
                void addTasksToGroup(targetGroup, taskIdsToAdd);
            }
            finishDragging();
            return;
        }

        if (draggedOlderTaskIds.length > 0) {
            void moveTasksToToday(draggedOlderTaskIds, {
                kind: 'group',
                targetGroup,
                edge: intent,
            });
            finishDragging();
            return;
        }

        if (activeGroupId) {
            const draggedGroup = groups?.find(group => group.groupId === activeGroupId);
            if (draggedGroup && draggedGroup.groupId !== targetGroup.groupId) {
                const movedTaskIds = visibleTasks
                    .map(task => task.taskId)
                    .filter(taskId => draggedGroup.taskIds.includes(taskId));
                reorderRelativeToGroup(movedTaskIds, targetGroup, intent);
            }
            finishDragging();
            return;
        }

        if (draggedIds.length > 0) {
            const draggedIdSet = new Set(draggedIds);
            const movedTaskIds = visibleTasks
                .map(task => task.taskId)
                .filter(taskId => draggedIdSet.has(taskId));
            if (movedTaskIds.length > 0) {
                reorderRelativeToGroup(movedTaskIds, targetGroup, intent);
                minimizePomodoroTask(getPrimaryDraggedTaskId() ?? movedTaskIds[0]);
                const sourceGroups = (groups ?? []).filter(group =>
                    group.groupId !== targetGroup.groupId
                    && !getDraggedPreservedGroupIds().includes(group.groupId)
                    && movedTaskIds.some(taskId => group.taskIds.includes(taskId)),
                );
                sourceGroups.forEach(sourceGroup => {
                    void removeTasksFromGroup(sourceGroup, movedTaskIds);
                });
            }
        }
        finishDragging();
    }, [addTasksToGroup, finishDragging, getDraggedGroupId, getDraggedPreservedGroupIds, getDraggedTaskIds,
        getPrimaryDraggedTaskId, groups, minimizePomodoroTask, moveDraggedGroupToToday, moveTasksToToday,
        olderTasks, removeTasksFromGroup, reorderRelativeToGroup, visibleTasks]);

    const handleDropAtBottom = useCallback(() => {
        if (moveDraggedGroupToToday({ kind: 'edge', edge: 'bottom' })) return;
        if (moveDraggedOlderTasksToToday({ kind: 'edge', edge: 'bottom' })) return;

        const orderedTaskIds = visibleTasks.map(task => task.taskId);

        const activeGroupId = getDraggedGroupId();
        if (activeGroupId) {
            const group = groups?.find(candidate => candidate.groupId === activeGroupId);
            if (group) {
                const visibleGroupTaskIds = orderedTaskIds.filter(taskId => group.taskIds.includes(taskId));
                const groupTaskIdSet = new Set(visibleGroupTaskIds);
                const orderWithoutGroup = orderedTaskIds.filter(taskId => !groupTaskIdSet.has(taskId));
                persistTaskOrder([...orderWithoutGroup, ...visibleGroupTaskIds]);
            }
            finishDragging();
            return;
        }

        const draggedIds = getDraggedTaskIds();
        if (draggedIds.length > 0) {
            const draggedIdSet = new Set(draggedIds);
            const movedTaskIds = orderedTaskIds.filter(taskId => draggedIdSet.has(taskId));
            if (movedTaskIds.length > 0) {
                const orderWithoutMovedTasks = orderedTaskIds.filter(taskId => !draggedIdSet.has(taskId));
                const nextOrder = [...orderWithoutMovedTasks, ...movedTaskIds];
                minimizePomodoroTask(getPrimaryDraggedTaskId() ?? movedTaskIds[0]);
                persistTaskOrder(nextOrder);
                const sourceGroups = (groups ?? []).filter(group =>
                    !getDraggedPreservedGroupIds().includes(group.groupId)
                    && movedTaskIds.some(taskId => group.taskIds.includes(taskId)),
                );
                sourceGroups.forEach(sourceGroup => {
                    void removeTasksFromGroup(sourceGroup, movedTaskIds);
                });
            }
        }
        finishDragging();
    }, [finishDragging, getDraggedGroupId, getDraggedPreservedGroupIds, getDraggedTaskIds, getPrimaryDraggedTaskId, groups, minimizePomodoroTask,
        moveDraggedGroupToToday, moveDraggedOlderTasksToToday, persistTaskOrder, removeTasksFromGroup, visibleTasks]);

    const handleDropAtTop = useCallback(() => {
        if (moveDraggedGroupToToday({ kind: 'edge', edge: 'top' })) return;
        if (moveDraggedOlderTasksToToday({ kind: 'edge', edge: 'top' })) return;

        const orderedTaskIds = visibleTasks.map(task => task.taskId);

        const activeGroupId = getDraggedGroupId();
        if (activeGroupId) {
            const group = groups?.find(candidate => candidate.groupId === activeGroupId);
            if (group) {
                const visibleGroupTaskIds = orderedTaskIds.filter(taskId => group.taskIds.includes(taskId));
                const groupTaskIdSet = new Set(visibleGroupTaskIds);
                persistTaskOrder([
                    ...visibleGroupTaskIds,
                    ...orderedTaskIds.filter(taskId => !groupTaskIdSet.has(taskId)),
                ]);
            }
            finishDragging();
            return;
        }

        const draggedIds = getDraggedTaskIds();
        if (draggedIds.length > 0) {
            const draggedIdSet = new Set(draggedIds);
            const movedTaskIds = orderedTaskIds.filter(taskId => draggedIdSet.has(taskId));
            if (movedTaskIds.length > 0) {
                persistTaskOrder([
                    ...movedTaskIds,
                    ...orderedTaskIds.filter(taskId => !draggedIdSet.has(taskId)),
                ]);
                minimizePomodoroTask(getPrimaryDraggedTaskId() ?? movedTaskIds[0]);
                const sourceGroups = (groups ?? []).filter(group =>
                    !getDraggedPreservedGroupIds().includes(group.groupId)
                    && movedTaskIds.some(taskId => group.taskIds.includes(taskId)),
                );
                sourceGroups.forEach(sourceGroup => {
                    void removeTasksFromGroup(sourceGroup, movedTaskIds);
                });
            }
        }
        finishDragging();
    }, [finishDragging, getDraggedGroupId, getDraggedPreservedGroupIds, getDraggedTaskIds, getPrimaryDraggedTaskId, groups, minimizePomodoroTask,
        moveDraggedGroupToToday, moveDraggedOlderTasksToToday, persistTaskOrder, removeTasksFromGroup, visibleTasks]);

    const handleEdgeDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
        if (!hasActiveDrag()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragTargetTaskId(null);
        setDragTargetGroupId(null);
        setDragTargetPosition(null);
        const listBounds = event.currentTarget.parentElement?.getBoundingClientRect();
        setDragEdge(listBounds && event.clientY >= listBounds.top + listBounds.height / 2 ? 'bottom' : 'top');
    }, [hasActiveDrag]);

    const handleDropAtEdge = useCallback((event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const listBounds = event.currentTarget.parentElement?.getBoundingClientRect();
        if (listBounds && event.clientY < listBounds.top + listBounds.height / 2) {
            handleDropAtTop();
        } else {
            handleDropAtBottom();
        }
    }, [handleDropAtBottom, handleDropAtTop]);

    function keepDragTargetInView(event: React.DragEvent<HTMLElement>) {
        if (!hasActiveDrag()) return;

        const scrollContainer = event.currentTarget.parentElement;
        if (!scrollContainer) return;

        const bounds = scrollContainer.getBoundingClientRect();
        const edgeThreshold = 72;
        if (event.clientY < bounds.top + edgeThreshold) {
            scrollContainer.scrollBy({ top: -18 });
        } else if (event.clientY > bounds.bottom - edgeThreshold) {
            scrollContainer.scrollBy({ top: 18 });
        }
    }

    function clearSelection() {
        setSelectedTaskIds([]);
        setSelectedGroupIds([]);
        const keepActivePomodoroOpen = activeExpansion?.panel === 'pomodoro'
            && activeExpansion.taskId === activePomodoroTaskIdRef.current;
        if (!keepActivePomodoroOpen) setActiveExpansion(null);
        setBulkDateAnchorEl(null);
        setGroupAnchorEl(null);
        setGroupName('');
        setParentTaskAnchorEl(null);
        setTaskContextMenu(null);
        selectionAnchorRef.current = null;
    }

    async function undoTaskFeedback() {
        const undo = taskFeedback?.undo;
        const pendingUndo = pendingUndoRef.current;
        if (!undo) return;
        if (pendingUndo) window.clearTimeout(pendingUndo.timeoutId);
        pendingUndoRef.current = null;
        setTaskFeedback(null);
        try {
            await undo();
        } catch (error) {
            console.error('Error undoing Home task action:', error);
            showTaskFeedback('error', 'Could not undo that action');
        }
    }

    function openBulkDatePicker(anchorEl: HTMLElement) {
        const firstScheduledDate = selectedTasks
            .map(task => task.scheduledPerformDateTime)
            .map(value => value ? new Date(value) : null)
            .find((value): value is Date => value !== null && !Number.isNaN(value.getTime()));
        setBulkDateDraft(firstScheduledDate ?? new Date());
        setBulkDateAnchorEl(anchorEl);
    }

    async function createGroup() {
        const trimmedName = groupName.trim();
        if (!trimmedName || !canGroupSelectedTasks) return;

        setGroupSubmitting(true);
        try {
            const selectedTaskIdsForGroup = selectedTasks.map(task => task.taskId);
            const selectedTaskIdSet = new Set(selectedTaskIdsForGroup);
            const createdGroup = await taskGroupService.createGroup(trimmedName, selectedTaskIdsForGroup);
            setGroups(previous => [
                ...(previous ?? [])
                    .map(group => ({
                        ...group,
                        taskIds: group.taskIds.filter(taskId => !selectedTaskIdSet.has(taskId)),
                    }))
                    .filter(group => group.taskIds.length >= 2),
                createdGroup,
            ]);
            clearSelection();
            setCollapsedGroupIds(previous => new Set(previous).add(createdGroup.groupId));
        } catch (err) {
            console.error('Error creating task group:', err);
        } finally {
            setGroupSubmitting(false);
        }
    }

    async function createParentTask(name: string) {
        if (!canCreateParentTask || parentTaskSubmitting) return;

        const selectedTaskIdsForParent = selectedTasks.map(task => task.taskId);
        setParentTaskSubmitting(true);
        try {
            const parentTask = await taskService.createTask({
                name,
                description: '',
                scheduledPerformDateTime: selectedTasks[0]?.scheduledPerformDateTime
                    ?? formatLocalDateTime(new Date()),
                tag: '',
                importance: 0,
            });
            await taskService.moveTasksToParent(selectedTaskIdsForParent, parentTask.taskId);
            await refreshTaskBuckets(true);
            clearSelection();
            showTaskFeedback(
                'success',
                `Created “${parentTask.name}” with ${selectedTaskIdsForParent.length} subtasks`,
            );
        } catch (error) {
            console.error('Error creating parent task from selected tasks:', error);
            try {
                await refreshTaskBuckets(true);
            } catch (refreshError) {
                console.error('Error refreshing tasks after creating parent task:', refreshError);
            }
            showTaskFeedback('error', 'Could not group the selected tasks as subtasks');
            throw error;
        } finally {
            setParentTaskSubmitting(false);
        }
    }

    async function createTaskInGroup(
        group: TaskGroup,
        firstVisibleTaskId?: string,
        taskToCreate?: TaskToCreate,
    ) {
        if (!taskToCreate?.name.trim() || group.linkedToMentalThread || groupTaskSubmissionRef.current) return;

        groupTaskSubmissionRef.current = true;
        setGroupTaskInputGeneration(previous => previous + 1);
        const optimisticTaskId = `optimistic-task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        rememberTaskRenderKey(optimisticTaskId, optimisticTaskId);
        const now = new Date();
        const optimisticTask: Task = {
            taskId: optimisticTaskId,
            name: taskToCreate.name,
            description: taskToCreate.description,
            completed: false,
            creationDateTime: formatLocalDateTime(now),
            creationDate: formatLocalDateTime(now).slice(0, 10),
            scheduledPerformDateTime: taskToCreate.scheduledPerformDateTime || formatLocalDateTime(now),
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
        const optimisticTaskIds = [...group.taskIds, optimisticTaskId];
        const taskOrder = allTasks.map(task => task.taskId);
        const groupTaskIndex = taskOrder.indexOf(firstVisibleTaskId ?? group.taskIds[0]);
        taskOrder.splice(groupTaskIndex === -1 ? taskOrder.length : groupTaskIndex, 0, optimisticTaskId);

        // Put the new task in the same position as the server-created task before
        // either network request completes. The temporary ID is reconciled below.
        setGroups(previous => (previous ?? []).map(existingGroup =>
            existingGroup.groupId === group.groupId
                ? { ...existingGroup, taskIds: optimisticTaskIds }
                : existingGroup,
        ));
        addTaskToState(optimisticTask);
        reorderTasksInState(taskOrder);
        setCollapsedGroupIds(previous => {
            if (!previous.has(group.groupId)) return previous;

            const next = new Set(previous);
            next.delete(group.groupId);
            return next;
        });

        let createdTaskId: string | null = null;
        try {
            const createdTask = await taskService.createTask(taskToCreate);
            createdTaskId = createdTask.taskId;
            showTaskCreationDateFeedback(taskToCreate.scheduledPerformDateTime);
            rememberTaskRenderKey(createdTask.taskId, optimisticTaskId);
            const nextTaskIds = optimisticTaskIds.map(taskId =>
                taskId === optimisticTaskId ? createdTask.taskId : taskId,
            );
            const nextTaskOrder = taskOrder.map(taskId =>
                taskId === optimisticTaskId ? createdTask.taskId : taskId,
            );
            setGroups(previous => replaceTaskIdInGroup(
                previous,
                group.groupId,
                optimisticTaskId,
                createdTask.taskId,
            ));
            updateTasksInState([{
                taskId: optimisticTaskId,
                updates: createdTask,
            }], nextTaskOrder);
            await persistTaskOrder(nextTaskOrder);

            const updatedGroup = await taskGroupService.replaceTasks(group.groupId, nextTaskIds);
            setGroups(previous => replaceTaskGroupIfChanged(previous, updatedGroup));
        } catch (err) {
            console.error('Error creating task in group:', err);
            if (createdTaskId === null) {
                removeTaskFromState(optimisticTaskId);
                setGroups(previous => removeTaskIdFromGroup(previous, group.groupId, optimisticTaskId));
            } else {
                await refreshGroups();
            }
        } finally {
            groupTaskSubmissionRef.current = false;
        }
    }

    function startTaskInGroup(groupId: string) {
        if (groupTaskSubmissionRef.current || groups?.some(group => (
            group.groupId === groupId && group.linkedToMentalThread
        ))) return;
        setGroupAddingTaskId(groupId);
        setCollapsedGroupIds(previous => {
            if (!previous.has(groupId)) return previous;

            const next = new Set(previous);
            next.delete(groupId);
            return next;
        });
    }

    async function confirmUngroup() {
        if (!deleteRequest || deleteRequest.kind !== 'group' || deleteSubmitting) return;

        const group = deleteRequest.group;
        if (group.isStatGroup) return;
        setDeleteSubmitting(true);
        setDeleteRequest(null);
        try {
            await taskGroupService.deleteGroup(group.groupId);
            setGroups(previous => (previous ?? []).filter(existingGroup => existingGroup.groupId !== group.groupId));
            setCollapsedGroupIds(previous => {
                const next = new Set(previous);
                next.delete(group.groupId);
                return next;
            });
            setSelectedGroupIds(previous => previous.filter(groupId => groupId !== group.groupId));
        } catch (err) {
            console.error('Error ungrouping task group:', err);
            await refreshGroups();
        } finally {
            setDeleteSubmitting(false);
            setDeleteRequest(null);
        }
    }

    function toggleGroup(groupId: string) {
        setCollapsedGroupIds(previous => {
            const next = new Set(previous);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    }

    const handleTaskDragStart = useCallback((draggedTask: Task) => {
        if (pendingDeletedTaskIdSet.has(draggedTask.taskId)) return;
        if (draggedTask.taskId === activePomodoroTaskIdRef.current) {
            clearFocusTransitionTimer();
            setActiveExpansion(null);
            setInitialPomodoroStatus(null);
            setFocusVisibility('all');
        }
        const sourceTasks = olderTaskIdSet.has(draggedTask.taskId) ? olderTasks : visibleTasks;
        const selectedSourceTaskIds = sourceTasks
            .map(task => task.taskId)
            .filter(taskId => selectedActionTaskIdSet.has(taskId));
        const taskIdsToDrag = selectedActionTaskIdSet.has(draggedTask.taskId)
            ? selectedSourceTaskIds
            : [draggedTask.taskId];
        activeDragRef.current = {
            kind: 'tasks',
            taskIds: taskIdsToDrag,
            primaryTaskId: draggedTask.taskId,
            preservedGroupIds: selectedGroupIds,
        };
        setDraggedTaskIds(taskIdsToDrag);
        setDraggedTaskId(draggedTask.taskId);
        setDraggedGroupId(null);
        setDragTargetTaskId(null);
        setDragTargetGroupId(null);
        setDragTargetPosition(null);
        setDragEdge(null);
    }, [clearFocusTransitionTimer, olderTaskIdSet, olderTasks, pendingDeletedTaskIdSet,
        selectedActionTaskIdSet, selectedGroupIds, visibleTasks]);

    const handleTaskDragOver = useCallback((dragTargetTask: Task, event: React.DragEvent<HTMLElement>) => {
        const currentDraggedTaskIds = getDraggedTaskIds();
        const activeGroupId = getDraggedGroupId();
        setDragEdge(null);
        const containingGroup = groups?.find(group => group.taskIds.includes(dragTargetTask.taskId));
        const targetGroupLinked = Boolean(containingGroup?.isStatGroup || containingGroup?.linkedToMentalThread);
        if ((currentDraggedTaskIds.length > 0 && !currentDraggedTaskIds.includes(dragTargetTask.taskId)) || activeGroupId) {
            const addingToExpandedGroup = Boolean(
                containingGroup
                && currentDraggedTaskIds.length > 0
                && !activeGroupId
                && !targetGroupLinked
                && currentDraggedTaskIds.some(taskId => !containingGroup.taskIds.includes(taskId)),
            );
            if (addingToExpandedGroup) {
                const edge = taskDropEdge(event);
                setDragTargetTaskId(dragTargetTask.taskId);
                setDragTargetGroupId(containingGroup!.groupId);
                setDragTargetPosition(edge);
                return;
            }

            const edge = containingGroup ? taskDropEdge(event) : dropIntent(event);
            setDragTargetTaskId(dragTargetTask.taskId);
            setDragTargetGroupId(null);
            setDragTargetPosition(edge);
        }
    }, [getDraggedGroupId, getDraggedTaskIds, groups]);

    const handleTaskDrop = useCallback((
        droppedTask: Task,
        event: React.DragEvent<HTMLElement>,
        groupPlacement?: GroupTaskDropPlacement,
    ) => {
        const currentDraggedTaskIds = getDraggedTaskIds();
        const activeGroupId = getDraggedGroupId();
        const containingGroup = groups?.find(group => group.taskIds.includes(droppedTask.taskId));
        const olderTaskIdSet = new Set(olderTasks.map(olderTask => olderTask.taskId));
        const draggedOlderTaskIds = currentDraggedTaskIds.filter(taskId => olderTaskIdSet.has(taskId));
        const intent = activeGroupId ? taskDropEdge(event) : groupPlacement?.edge ?? dropIntent(event);
        const canAddToContainingGroup = Boolean(
            containingGroup
            && !containingGroup.isStatGroup
            && !containingGroup.linkedToMentalThread
            && !activeGroupId
            && currentDraggedTaskIds.length > 0
            && currentDraggedTaskIds.some(taskId => !containingGroup.taskIds.includes(taskId)),
        );
        if (canAddToContainingGroup) {
            void (async () => {
                if (draggedOlderTaskIds.length > 0 && !(await moveTasksToToday(draggedOlderTaskIds))) return;
                await addTasksToGroup(containingGroup!, currentDraggedTaskIds, groupPlacement ?? {
                    targetTaskId: droppedTask.taskId,
                    edge: taskDropEdge(event),
                });
            })();
            finishDragging();
            return;
        }

        if (!activeGroupId && intent === 'inside' && currentDraggedTaskIds.length > 0
            && !currentDraggedTaskIds.includes(droppedTask.taskId)) {
            void groupTasksFromDrop(droppedTask, currentDraggedTaskIds);
            finishDragging();
            return;
        }

        if (moveDraggedOlderTasksToToday(
            intent === 'inside' ? undefined : { kind: 'task', targetTaskId: droppedTask.taskId, edge: intent },
        )) return;
        handleDropOnTask(droppedTask, intent === 'inside' ? 'before' : intent);
    }, [addTasksToGroup, finishDragging, getDraggedGroupId, getDraggedTaskIds, groups,
        groupTasksFromDrop, handleDropOnTask, moveDraggedOlderTasksToToday, moveTasksToToday, olderTasks]);

    const refreshHomeTasks = useCallback(() => refreshTaskBuckets(true), [refreshTaskBuckets]);

    function renderTaskRow(
        task: Task,
        options: {
            reorderable?: boolean;
            draggable?: boolean;
            showScheduledDate?: boolean;
            grouped?: boolean;
        } = {},
    ) {
        const reorderable = options.reorderable ?? true;
        // content-visibility:auto can skip a transform-animated focus row and cause a one-frame repaint.
        const isFocusedPomodoroRow = focusedPomodoroTask?.taskId === task.taskId;
        const isGlobalActivePomodoro = activePomodoro?.active
            && activePomodoro.associatedTaskId === task.taskId;
        const rowHasActivePomodoro = isGlobalActivePomodoro || task.taskId === activePomodoroTaskId;
        const rowDraggable = (options.draggable ?? reorderable)
            && !pendingDeletedTaskIdSet.has(task.taskId);
        return (
            <Box
                key={getTaskRenderKey(task.taskId)}
                sx={isFocusedPomodoroRow
                    ? { contentVisibility: 'visible' }
                    : options.grouped
                        ? { contentVisibility: 'visible' }
                        : { contentVisibility: 'auto', containIntrinsicSize: '52px' }}
            >
                <FlatTaskRow
                    task={task}
                    onToggle={toggleTaskCompletion}
                    onUpdate={updateTask}
                    expandedPanel={activeExpansion?.taskId === task.taskId
                        ? activeExpansion.panel
                        : isGlobalActivePomodoro ? 'pomodoro' : null}
                    onTogglePanel={handleTogglePanel}
                    onAutoExpand={handleAutoExpand}
                    selected={selectedTaskIdSet.has(task.taskId)}
                    editRequestId={editRequest?.taskId === task.taskId ? editRequest.requestId : null}
                    onSelectionClick={handleTaskSelection}
                    onContextMenu={handleTaskContextMenu}
                    onDelete={deleteTask}
                    showScheduledDate={options.showScheduledDate}
                    allowThreadTaskScheduling
                    pomodoroDisabled={Boolean(activePomodoroTaskIdForRender) && !rowHasActivePomodoro}
                    reorderable={reorderable}
                    draggable={rowDraggable}
                    onDragStart={handleTaskDragStart}
                    onDragOver={handleTaskDragOver}
                    onDrop={handleTaskDrop}
                    onDragEnd={finishDragging}
                    isDragging={draggedTaskIds.includes(task.taskId) || draggedTaskId === task.taskId}
                    isDragTarget={dragTargetTaskId === task.taskId}
                    dragTargetEdge={dragTargetPosition === 'after' ? 'after' : 'before'}
                    isGroupDropTarget={dragTargetTaskId === task.taskId && dragTargetPosition === 'inside'}
                    onPomodoroActiveChange={handlePomodoroActiveChange}
                    onPomodoroStatusChange={handlePomodoroStatusChange}
                    onRefreshTasks={refreshHomeTasks}
                    prefetchDetailsOnMount
                    deferPomodoroHydration={!rowHasActivePomodoro}
                    subtaskDeletionContextMenu
                    initialPomodoroStatus={isGlobalActivePomodoro
                        ? activePomodoro
                        : task.taskId === activePomodoroTaskId ? initialPomodoroStatus : null}
                    expectedPomodoroActive={rowHasActivePomodoro}
                    onScheduledDateEditComplete={handleScheduledDateEditComplete}
                />
            </Box>
        );
    }

    function renderTaskList(
        items: TaskListItem[],
        options: { reorderable?: boolean; draggable?: boolean; showScheduledDate?: boolean } = {},
    ) {
        const reorderable = options.reorderable ?? true;
        return items.map(item => {
            if (item.kind === 'task') return renderTaskRow(item.task, options);

            const collapsed = collapsedGroupIds.has(item.expansionId);
            const groupCompleted = item.tasks.length > 0 && item.tasks.every(task => task.completed);
            const linkedGroup = Boolean(item.group.linkedToMentalThread)
                || Boolean(item.group.isStatGroup);
            if (item.group.isStatGroup) {
                const groupSelected = selectedGroupIdSet.has(item.group.groupId);
                const groupDragging = item.tasks.some(task => draggedTaskIds.includes(task.taskId));
                const groupDragTarget = dragTargetGroupId === item.group.groupId;
                const groupDraggable = (options.draggable ?? reorderable)
                    && !item.group.taskIds.some(taskId => pendingDeletedTaskIdSet.has(taskId));
                return (
                    <Box
                        key={item.group.groupId}
                        sx={{
                            borderRadius: 1.5,
                            boxShadow: groupSelected
                                ? theme => `inset 0 0 0 2px ${alpha(theme.palette.primary.main, 0.38)}`
                                : 'none',
                            mb: 0.4,
                            transition: 'box-shadow 0.18s',
                        }}
                    >
                        <Box
                            data-stat-task-group-header="true"
                            data-task-group-id={item.group.groupId}
                            draggable={groupDraggable}
                            onMouseDownCapture={event => {
                                const target = event.target;
                                const interactive = target instanceof Element
                                    && target.closest(
                                        'button, input, textarea, select, [role="button"], .MuiButtonBase-root, [contenteditable="true"]',
                                    ) !== null;
                                event.currentTarget.draggable = groupDraggable && !interactive;
                            }}
                            onMouseUpCapture={event => {
                                event.currentTarget.draggable = groupDraggable;
                            }}
                            onDragStart={groupDraggable ? event => {
                                event.dataTransfer.effectAllowed = 'move';
                                const selectedGroupIsBeingDragged = selectedGroupIdSet.has(item.group.groupId);
                                const hasOtherSelectedEntity = selectedGroupIds.length > 1
                                    || selectedTaskIds.some(taskId => !selectedGroupTaskIdSet.has(taskId));
                                const isMixedDrag = selectedGroupIsBeingDragged && hasOtherSelectedEntity;
                                const dragSourceTasks = options.showScheduledDate ? olderTasks : visibleTasks;
                                const taskIdsToDrag = isMixedDrag
                                    ? dragSourceTasks
                                        .map(task => task.taskId)
                                        .filter(taskId => selectedActionTaskIdSet.has(taskId))
                                    : item.tasks.map(task => task.taskId);
                                const primaryTaskId = item.tasks.find(task => taskIdsToDrag.includes(task.taskId))?.taskId
                                    ?? taskIdsToDrag[0]
                                    ?? '';
                                event.dataTransfer.setData('text/plain', primaryTaskId);
                                activeDragRef.current = {
                                    kind: 'tasks',
                                    taskIds: taskIdsToDrag,
                                    primaryTaskId,
                                    preservedGroupIds: selectedGroupIsBeingDragged
                                        ? selectedGroupIds
                                        : [item.group.groupId],
                                };
                                setDraggedTaskIds(taskIdsToDrag);
                                setDraggedTaskId(primaryTaskId || null);
                                setDraggedGroupId(null);
                                if (!collapsed) {
                                    temporarilyCollapsedGroupIdRef.current = item.expansionId;
                                    setCollapsedGroupIds(previous => new Set(previous).add(item.expansionId));
                                } else {
                                    temporarilyCollapsedGroupIdRef.current = null;
                                }
                                setDragTargetGroupId(null);
                                setDragTargetTaskId(null);
                                setDragTargetPosition(null);
                                setDragEdge(null);
                            } : undefined}
                            onDragOver={reorderable ? event => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                                setDragEdge(null);
                                const activeGroupId = getDraggedGroupId();
                                const activeTaskIds = getDraggedTaskIds();
                                if (activeGroupId !== item.group.groupId || activeTaskIds.length > 0) {
                                    const intent = activeGroupId ? taskDropEdge(event) : dropIntent(event);
                                    if (linkedGroup && intent === 'inside') {
                                        setDragTargetGroupId(null);
                                        setDragTargetTaskId(null);
                                        setDragTargetPosition(null);
                                        return;
                                    }
                                    setDragTargetGroupId(item.group.groupId);
                                    setDragTargetTaskId(null);
                                    setDragTargetPosition(intent);
                                }
                            } : undefined}
                            onDrop={reorderable ? event => {
                                event.preventDefault();
                                event.stopPropagation();
                                const intent = getDraggedGroupId() ? taskDropEdge(event) : dropIntent(event);
                                handleDropOnGroup(item.group, intent);
                            } : undefined}
                            onDragEnd={groupDraggable ? event => {
                                event.currentTarget.draggable = groupDraggable;
                                finishDragging();
                            } : undefined}
                            sx={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                minHeight: 52,
                                px: 0.5,
                                borderRadius: 1.5,
                                color: 'text.secondary',
                                opacity: groupDragging ? 0.42 : 1,
                                transform: groupDragging ? 'scale(0.98)' : 'scale(1)',
                                backgroundColor: groupDragTarget && dragTargetPosition === 'inside'
                                    ? 'action.hover'
                                    : 'transparent',
                                textAlign: 'left',
                                transition: 'opacity 0.16s, transform 0.16s, background-color 0.18s',
                                '&:hover': { backgroundColor: 'action.hover' },
                                '&::before': groupDragTarget && !dragTargetTaskId && dragTargetPosition !== 'inside' ? {
                                    content: '""',
                                    position: 'absolute',
                                    top: dragTargetPosition === 'before' ? 0 : 'auto',
                                    bottom: dragTargetPosition === 'after' ? 0 : 'auto',
                                    left: 10,
                                    right: 10,
                                    height: 2,
                                    borderRadius: 2,
                                    backgroundColor: 'primary.main',
                                } : undefined,
                            }}
                        >
                            <IconButton
                                size="small"
                                aria-label={collapsed ? `Expand ${item.group.name}` : `Collapse ${item.group.name}`}
                                sx={{ width: 38, height: 38, p: 0, mr: 0.5, flexShrink: 0 }}
                                onClick={() => toggleGroup(item.expansionId)}
                            >
                                {collapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                            <Box sx={{
                                flex: 1,
                                minWidth: 0,
                                textAlign: 'left',
                                position: 'relative',
                                top: '-1px',
                                display: 'flex',
                                alignItems: 'baseline',
                            }}>
                                <Typography component="span" variant="body2" sx={{
                                    fontWeight: 650,
                                    overflowWrap: 'anywhere',
                                    textDecoration: groupCompleted ? 'line-through' : 'none',
                                }}>
                                    {item.group.name}
                                </Typography>
                                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1, flexShrink: 0 }}>
                                    {item.tasks.length}
                                </Typography>
                            </Box>
                            <IconButton
                                size="small"
                                color={groupSelected ? 'primary' : 'inherit'}
                                aria-label={groupSelected
                                    ? `Deselect group ${item.group.name}`
                                    : `Select group ${item.group.name}`}
                                title={groupSelected ? 'Deselect group' : 'Select group'}
                                onClick={event => handleGroupSelection(item.group.groupId, event)}
                            >
                                <AdsClickIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                color="inherit"
                                aria-label={`Add task to ${item.group.name}`}
                                title="Add task to group"
                                disabled
                            >
                                <AddIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                color="error"
                                aria-label={`Delete group ${item.group.name}`}
                                title="Delete group"
                                disabled
                            >
                                <DeleteOutlineIcon sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                        </Box>
                        <Collapse in={!collapsed} timeout="auto" unmountOnExit>
                            <Box data-stat-task-group-content={item.group.groupId} sx={{ ml: 1.7, pl: 1.1, borderLeft: '1px solid', borderColor: 'divider' }}>
                                <AnimatedGroupTaskRows
                                    tasks={item.tasks}
                                    renderTask={task => renderTaskRow(task, { ...options, grouped: true })}
                                />
                            </Box>
                        </Collapse>
                    </Box>
                );
            }

            const groupSelected = selectedGroupIdSet.has(item.group.groupId);
            const groupDragging = draggedGroupId === item.group.groupId;
            const groupDragTarget = dragTargetGroupId === item.group.groupId;
            const groupDraggable = (options.draggable ?? reorderable)
                && !item.group.taskIds.some(taskId => pendingDeletedTaskIdSet.has(taskId));
            return (
                <Box
                    key={item.group.groupId}
                    sx={{
                        borderRadius: 1.5,
                        boxShadow: groupSelected
                            ? theme => `inset 0 0 0 2px ${alpha(theme.palette.primary.main, 0.38)}`
                            : 'none',
                        mb: 0.4,
                        transition: 'box-shadow 0.18s',
                    }}
                >
                    <Box
                        data-task-group-header="true"
                        data-task-group-id={item.group.groupId}
                        draggable={groupDraggable}
                        onClick={event => {
                            event.stopPropagation();
                            if (event.shiftKey || event.ctrlKey || event.metaKey) {
                                handleGroupSelection(item.group.groupId, event);
                            } else {
                                toggleGroup(item.expansionId);
                            }
                        }}
                        onMouseDownCapture={event => {
                            const target = event.target;
                            const interactive = target instanceof Element
                                && target.closest(
                                    'button, input, textarea, select, [role="button"], .MuiButtonBase-root, [contenteditable="true"], [data-task-group-name="true"]',
                                ) !== null;
                            event.currentTarget.draggable = groupDraggable && !interactive;
                        }}
                        onMouseUpCapture={event => {
                            event.currentTarget.draggable = groupDraggable;
                        }}
                        onDragStart={groupDraggable ? (event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            const selectedGroupIsBeingDragged = selectedGroupIdSet.has(item.group.groupId);
                            const hasOtherSelectedEntity = selectedGroupIds.length > 1
                                || selectedTaskIds.some(taskId => !selectedGroupTaskIdSet.has(taskId));
                            const isMixedDrag = selectedGroupIsBeingDragged && hasOtherSelectedEntity;
                            if (isMixedDrag) {
                                const dragSourceTasks = options.showScheduledDate ? olderTasks : visibleTasks;
                                const taskIdsToDrag = dragSourceTasks
                                    .map(task => task.taskId)
                                    .filter(taskId => selectedActionTaskIdSet.has(taskId));
                                const primaryTaskId = item.tasks.find(task => taskIdsToDrag.includes(task.taskId))?.taskId
                                    ?? taskIdsToDrag[0]
                                    ?? '';
                                event.dataTransfer.setData('text/plain', primaryTaskId);
                                activeDragRef.current = {
                                    kind: 'tasks',
                                    taskIds: taskIdsToDrag,
                                    primaryTaskId,
                                    preservedGroupIds: selectedGroupIds,
                                };
                                setDraggedTaskIds(taskIdsToDrag);
                                setDraggedTaskId(primaryTaskId || null);
                                setDraggedGroupId(null);
                            } else {
                                event.dataTransfer.setData('text/plain', `group:${item.group.groupId}`);
                                activeDragRef.current = { kind: 'group', groupId: item.group.groupId };
                                setDraggedGroupId(item.group.groupId);
                                setDraggedTaskIds([]);
                                setDraggedTaskId(null);
                            }
                            if (!collapsed) {
                                temporarilyCollapsedGroupIdRef.current = item.expansionId;
                                setCollapsedGroupIds(previous => new Set(previous).add(item.expansionId));
                            } else {
                                temporarilyCollapsedGroupIdRef.current = null;
                            }
                            setDragTargetGroupId(null);
                            setDragTargetTaskId(null);
                            setDragTargetPosition(null);
                            setDragEdge(null);
                        } : undefined}
                        onDragOver={reorderable ? (event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            setDragEdge(null);
                            const activeGroupId = getDraggedGroupId();
                            const activeTaskIds = getDraggedTaskIds();
                            if (activeGroupId !== item.group.groupId || activeTaskIds.length > 0) {
                                const intent = activeGroupId ? taskDropEdge(event) : dropIntent(event);
                                if (linkedGroup && intent === 'inside') {
                                    setDragTargetGroupId(null);
                                    setDragTargetTaskId(null);
                                    setDragTargetPosition(null);
                                    return;
                                }
                                setDragTargetGroupId(item.group.groupId);
                                setDragTargetTaskId(null);
                                setDragTargetPosition(intent);
                                setDragEdge(null);
                            }
                        } : undefined}
                        onDrop={reorderable ? (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const intent = getDraggedGroupId() ? taskDropEdge(event) : dropIntent(event);
                            handleDropOnGroup(item.group, intent);
                        } : undefined}
                        onDragEnd={groupDraggable ? event => {
                            event.currentTarget.draggable = groupDraggable;
                            finishDragging();
                        } : undefined}
                        sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 52,
                            borderRadius: 1.5,
                            px: 0.5,
                            color: 'text.secondary',
                            opacity: groupDragging ? 0.42 : 1,
                            transform: groupDragging ? 'scale(0.98)' : 'scale(1)',
                            backgroundColor: groupDragTarget && dragTargetPosition === 'inside'
                                ? 'action.hover'
                                : 'transparent',
                            transition: 'opacity 0.16s, transform 0.16s, background-color 0.18s',
                            '&:hover': {
                                backgroundColor: 'action.hover',
                            },
                            '&::before': groupDragTarget && !dragTargetTaskId && dragTargetPosition !== 'inside' ? {
                                content: '""',
                                position: 'absolute',
                                top: dragTargetPosition === 'before' ? 0 : 'auto',
                                bottom: dragTargetPosition === 'after' ? 0 : 'auto',
                                left: 10,
                                right: 10,
                                height: 2,
                                borderRadius: 2,
                                backgroundColor: 'primary.main',
                            } : undefined,
                        }}
                    >
                        <IconButton
                            size="small"
                            aria-label={collapsed ? `Expand ${item.group.name}` : `Collapse ${item.group.name}`}
                            sx={{ width: 38, height: 38, p: 0, mr: 0.5, flexShrink: 0 }}
                            onClick={event => {
                                event.stopPropagation();
                                toggleGroup(item.expansionId);
                            }}
                        >
                            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                        {editingGroupId === item.group.groupId ? (
                            <TextField
                                value={localGroupName}
                                inputRef={groupNameInputRef}
                                autoComplete="off"
                                onClick={event => event.stopPropagation()}
                                onChange={event => setLocalGroupName(event.target.value)}
                                onBlur={() => void commitGroupName(item.group)}
                                onKeyDown={event => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void commitGroupName(item.group);
                                    }
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancelGroupNameEditing(item.group);
                                    }
                                }}
                                variant="standard"
                                autoFocus
                                fullWidth
                                InputProps={{ disableUnderline: true }}
                                inputProps={{ draggable: false, 'data-task-group-name-input': 'true' }}
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    position: 'relative',
                                    top: '-1px',
                                    '& .MuiInputBase-input': {
                                        fontSize: '0.95rem',
                                        fontWeight: 650,
                                        lineHeight: 1.5,
                                        padding: 0,
                                    },
                                }}
                            />
                        ) : (
                            <Box sx={{
                                flex: 1,
                                minWidth: 0,
                                textAlign: 'left',
                                position: 'relative',
                                top: '-1px',
                                display: 'flex',
                                alignItems: 'baseline',
                            }}>
                                <Box
                                    component="span"
                                    data-task-group-name="true"
                                    onClick={event => startGroupNameEditing(item.group, event)}
                                    sx={{
                                        display: 'inline-block',
                                        maxWidth: 'calc(100% - 8px)',
                                        paddingRight: '32px',
                                        textAlign: 'left',
                                        cursor: 'text',
                                    }}
                                >
                                    <Typography component="span" variant="body2" display="inline" sx={{
                                        fontWeight: 650,
                                        textDecoration: groupCompleted ? 'line-through' : 'none',
                                    }}>
                                        {item.group.name}
                                    </Typography>
                                </Box>
                                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: '-24px', flexShrink: 0 }}>
                                    {item.tasks.length}
                                </Typography>
                            </Box>
                        )}
                        <IconButton
                            size="small"
                            color={selectedGroupIdSet.has(item.group.groupId) ? 'primary' : 'inherit'}
                            aria-label={selectedGroupIdSet.has(item.group.groupId)
                                ? `Deselect group ${item.group.name}`
                                : `Select group ${item.group.name}`}
                            title={selectedGroupIdSet.has(item.group.groupId) ? 'Deselect group' : 'Select group'}
                            onClick={event => handleGroupSelection(item.group.groupId, event)}
                        >
                            <AdsClickIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            color="inherit"
                            aria-label={`Add task to ${item.group.name}`}
                            title="Add task to group"
                            onClick={event => {
                                event.stopPropagation();
                                startTaskInGroup(item.group.groupId);
                            }}
                            disabled={linkedGroup || groupAddingTaskId === item.group.groupId}
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            color="error"
                            aria-label={`Delete group ${item.group.name}`}
                            title="Delete group"
                            onClick={event => {
                                event.stopPropagation();
                                requestGroupDelete(item.group, event.currentTarget);
                            }}
                        >
                            <DeleteOutlineIcon sx={{ fontSize: '1.1rem' }} />
                        </IconButton>
                    </Box>
                    <Collapse in={!collapsed} timeout="auto" unmountOnExit>
                        <Box
                            data-task-group-content={item.group.groupId}
                            onDragOver={reorderable ? (event) => {
                                setDragEdge(null);
                                if (isDragOverTask(event) || getDraggedGroupId() || getDraggedTaskIds().length === 0) return;
                                if (linkedGroup && getDraggedTaskIds().some(taskId => !item.group.taskIds.includes(taskId))) {
                                    setDragTargetGroupId(null);
                                    setDragTargetTaskId(null);
                                    setDragTargetPosition(null);
                                    return;
                                }

                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                                const placement = groupTaskDropPlacement(event, item.group);
                                if (placement) {
                                    setDragTargetGroupId(item.group.groupId);
                                    setDragTargetTaskId(placement.targetTaskId);
                                    setDragTargetPosition(placement.edge);
                                    setDragEdge(null);
                                    return;
                                }

                                setDragTargetGroupId(item.group.groupId);
                                setDragTargetTaskId(null);
                                setDragTargetPosition('inside');
                                setDragEdge(null);
                            } : undefined}
                            onDrop={reorderable ? (event) => {
                                if (isDragOverTask(event) || getDraggedGroupId() || getDraggedTaskIds().length === 0) return;

                                const placement = groupTaskDropPlacement(event, item.group);
                                const droppedTask = placement
                                    ? item.tasks.find(task => task.taskId === placement.targetTaskId)
                                    : undefined;
                                if (placement && droppedTask) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleTaskDrop(droppedTask, event, placement);
                                    return;
                                }

                                event.preventDefault();
                                event.stopPropagation();
                                handleDropOnGroup(item.group, 'inside');
                            } : undefined}
                            sx={{
                                ml: 1.7,
                                pl: 1.1,
                                borderLeft: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                backgroundColor: groupDragTarget && dragTargetPosition === 'inside'
                                    ? theme => alpha(theme.palette.primary.main, 0.045)
                                    : 'transparent',
                                transition: 'background-color 0.18s',
                            }}
                        >
                            <Collapse
                                in={!linkedGroup && groupAddingTaskId === item.group.groupId}
                                timeout={180}
                                unmountOnExit
                                sx={{
                                    willChange: 'height',
                                    '& .MuiCollapse-wrapper': { willChange: 'height' },
                                }}
                            >
                                <Fade in={groupAddingTaskId === item.group.groupId} timeout={150}>
                                    <GroupTaskInputRow
                                        key={`${item.group.groupId}:${groupTaskInputGeneration}`}
                                        contextName={item.group.name}
                                        animate
                                        onSubmit={taskToCreate => {
                                            void createTaskInGroup(item.group, item.tasks[0]?.taskId, taskToCreate);
                                        }}
                                        onEscape={() => setGroupAddingTaskId(null)}
                                        onBlur={() => setGroupAddingTaskId(null)}
                                    />
                                </Fade>
                            </Collapse>
                            <AnimatedGroupTaskRows
                                tasks={item.tasks}
                                renderTask={task => renderTaskRow(task, { ...options, grouped: true })}
                            />
                        </Box>
                    </Collapse>
                </Box>
            );
        });
    }

    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'Good wee hours' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user?.firstName || user?.username || '';
    const overdueCount = pastTasks.filter(task => !task.completed).length;
    const showTasksBelowFocus = !focusedPomodoroTask
        || focusVisibility === 'all'
        || focusVisibility === 'revealing'
        || focusVisibility === 'fading'
        || focusVisibility === 'returning';
    const showHomeSections = !allTodayTasksComplete || showCompletionDetails;
    const hasHomeTaskRows = visibleTasks.length > 0 || focusedPomodoroTask !== null
        || homeTaskListAnimating || allTodayTasksComplete;
    const todayCompletionMessage = allTodayTasksComplete ? (
        <ButtonBase
            type="button"
            aria-label={showCompletionDetails
                ? 'Hide today’s completed tasks and details'
                : 'Show today’s completed tasks and details'}
            aria-expanded={showCompletionDetails}
            aria-controls="completed-today-task-list home-completion-details"
            onClick={event => {
                event.stopPropagation();
                const nextExpanded = !showCompletionDetails;
                setShowCompletionDetails(nextExpanded);
                completionCardExpansionRef.current = nextExpanded;
                if (focusVisibility === 'hidden') showAllTasks();
            }}
            aria-live="polite"
            sx={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 2.5,
                p: 2,
                border: '1px solid',
                borderColor: theme => alpha(theme.palette.success.main, 0.24),
                borderRadius: 2.5,
                backgroundColor: theme => alpha(theme.palette.success.main, 0.07),
                animation: `${buttonFadeIn} 220ms ease-out`,
                textAlign: 'left',
                '&:hover': {
                    backgroundColor: theme => alpha(theme.palette.success.main, 0.11),
                },
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <Typography align="left" variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    All done now. Congrats!
                </Typography>
            </Box>
            <Box sx={{
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                width: 38,
                height: 38,
                ml: 'auto',
                color: 'success.main',
                borderRadius: '50%',
                backgroundColor: theme => alpha(theme.palette.success.main, 0.14),
            }}>
                <CheckCircleOutlineIcon />
            </Box>
        </ButtonBase>
    ) : null;
    const dragInProgress = draggedTaskIds.length > 0 || draggedGroupId !== null;

    return (
        <PageWrapper>
            <Box
                sx={{ position: 'relative', flex: 1 }}
                onClick={clearSelection}
                onDragOverCapture={keepDragTargetInView}
            >
                <Box sx={{ maxWidth: 500, width: '100%', mx: 'auto', pt: 10, pb: 8, px: 2 }}>
                    <Typography
                        variant="h4"
                        color="text.secondary"
                        sx={{
                            mb: 4,
                            fontWeight: 400,
                            opacity: animateGreeting ? 0 : 1,
                            animation: animateGreeting
                                ? `${greetingReveal} 560ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards`
                                : 'none',
                        }}
                    >
                        {greeting}{firstName ? `, ${firstName}` : ''}.
                    </Typography>

                    <Box
                        sx={{
                            backgroundColor: 'background.paper',
                            borderRadius: 3,
                            px: 2.5,
                            py: 1.5,
                            mb: 5,
                            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                            '& .MuiInput-underline:before': { borderBottom: 'none' },
                            '& .MuiInput-underline:after': { borderBottom: 'none' },
                            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                            '& .MuiInput-root': { fontSize: '1.1rem' },
                        }}
                    >
                        <SmartTaskInput defaultToToday onSubmit={createTask} />
                    </Box>

                    {showHomeSections && selectionActionsVisible && selectionActionsPosition && (
                        <Portal>
                            <Box
                                ref={selectionActionsRef}
                                onClick={event => event.stopPropagation()}
                                sx={{
                                    position: 'fixed',
                                    top: selectionActionsPosition.top,
                                    left: selectionActionsPosition.left,
                                    zIndex: 1300,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.25,
                                    p: 0.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2.5,
                                    backgroundColor: 'background.paper',
                                    boxShadow: 4,
                                    transform: 'translateY(-50%)',
                                    animation: `${buttonFadeIn} 180ms ease-out`,
                                }}
                            >
                                <IconButton
                                    size="small"
                                    color="inherit"
                                    aria-label={selectedTasks.length > 0 && selectedTasks.every(task => task.completed)
                                        ? 'Reopen selected tasks'
                                        : 'Complete selected tasks'}
                                    title={selectedTasks.length > 0 && selectedTasks.every(task => task.completed)
                                        ? 'Reopen selected tasks'
                                        : 'Complete selected tasks'}
                                    onClick={() => performBulkAction(
                                        selectedTasks.length > 0 && selectedTasks.every(task => task.completed)
                                            ? 'reopen'
                                            : 'complete',
                                    )}
                                    disabled={bulkActionLoading || selectedTasks.length === 0}
                                >
                                    {selectedTasks.length > 0 && selectedTasks.every(task => task.completed)
                                        ? <ReplayIcon fontSize="small" />
                                        : <CheckCircleOutlineIcon fontSize="small" color="success" />}
                                </IconButton>
                                <IconButton
                                    size="small"
                                    color="inherit"
                                    aria-label="Move selected tasks to a date"
                                    title="Move selected tasks to a date"
                                    onClick={event => openBulkDatePicker(event.currentTarget)}
                                    disabled={bulkActionLoading || selectedTasks.length === 0}
                                >
                                    <CalendarMonthIcon fontSize="small" />
                                </IconButton>
                                {canCreateParentTask && (
                                    <IconButton
                                        size="small"
                                        color="inherit"
                                        aria-label="Make selected tasks subtasks of a new task"
                                        title="Make selected tasks subtasks of a new task"
                                        onClick={event => {
                                            event.stopPropagation();
                                            setParentTaskAnchorEl(event.currentTarget);
                                        }}
                                        disabled={bulkActionLoading || parentTaskSubmitting}
                                    >
                                        <AccountTreeIcon fontSize="small" />
                                    </IconButton>
                                )}
                                {canGroupSelectedTasks && (
                                    <IconButton
                                        size="small"
                                        color="inherit"
                                        aria-label="Group selected tasks"
                                        title="Group selected tasks"
                                        onClick={event => {
                                            event.stopPropagation();
                                            setGroupName('');
                                            setGroupAnchorEl(event.currentTarget);
                                        }}
                                        disabled={bulkActionLoading}
                                    >
                                        <GroupWorkIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <IconButton
                                    size="small"
                                    color="error"
                                    aria-label="Delete selected tasks"
                                    title="Delete selected tasks"
                                    onClick={event => requestBulkDelete(event.currentTarget)}
                                    disabled={bulkActionLoading || selectedTasks.length === 0}
                                >
                                    <DeleteSweepIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Portal>
                    )}

                    <Box ref={taskListTopRef} sx={{ height: 0 }} />

                    {homeContentReady && groups !== null && hasHomeTaskRows ? (
                        <>
                            {todayCompletionMessage}

                            {/* Keep the live Pomodoro row mounted while the surrounding task list animates. */}
                            {focusedPomodoroTask && (
                                <Box
                                    ref={focusedPomodoroRowRef}
                                    sx={{
                                        display: showHomeSections ? undefined : 'none',
                                        '--focus-task-offset': `${focusTaskOffset}px`,
                                        opacity: focusVisibility === 'fading' ? 0 : 1,
                                        pointerEvents: focusVisibility === 'fading'
                                            || focusVisibility === 'sliding'
                                            || focusVisibility === 'returning'
                                            ? 'none'
                                            : 'auto',
                                        willChange: focusVisibility === 'sliding' || focusVisibility === 'returning'
                                            ? 'transform, opacity'
                                            : 'auto',
                                        animation: focusVisibility === 'sliding'
                                            ? `${focusTaskSlide} ${FOCUS_TASK_SLIDE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`
                                            : focusVisibility === 'returning'
                                                ? `${focusTaskReturn} ${FOCUS_TASK_SLIDE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`
                                                : 'none',
                                    }}
                                >
                                    {renderTaskRow(focusedPomodoroTask)}
                                </Box>
                            )}

                            {showHomeSections && homeTaskControlsReady && focusedPomodoroTask && focusVisibility === 'hidden'
                                && tasksBelowFocus.length > 0 && (
                                <Button
                                    size="small"
                                    startIcon={<VisibilityIcon />}
                                    onClick={event => {
                                        event.stopPropagation();
                                        showAllTasks();
                                    }}
                                    sx={{
                                        mt: 1,
                                        mb: 0.75,
                                        animation: `${buttonFadeIn} 220ms ease-out`,
                                    }}
                                >
                                    Show all tasks
                                </Button>
                            )}

                            <Collapse
                                in={showTasksBelowFocus && showHomeSections}
                                timeout={focusVisibility === 'hidden' ? 0 : {
                                    enter: 260,
                                    exit: allTodayTasksComplete ? TASK_EXIT_DURATION_MS : TASKS_FADE_DURATION_MS,
                                }}
                                mountOnEnter
                                unmountOnExit
                            >
                                <Box
                                    id={allTodayTasksComplete ? 'completed-today-task-list' : undefined}
                                    sx={{
                                        animation: focusVisibility === 'fading' || focusVisibility === 'sliding'
                                            ? `${tasksFadeAway} ${TASKS_FADE_DURATION_MS}ms ease-out forwards`
                                            : focusVisibility === 'revealing' || focusVisibility === 'returning'
                                                ? `${tasksFadeBack} 260ms ease-out`
                                                : 'none',
                                        willChange: focusVisibility === 'fading' || focusVisibility === 'sliding'
                                            || focusVisibility === 'revealing'
                                            || focusVisibility === 'returning'
                                            ? 'opacity, transform'
                                            : 'auto',
                                        pointerEvents: focusVisibility === 'fading' || focusVisibility === 'sliding'
                                            ? 'none'
                                            : 'auto',
                                        position: 'relative',
                                    }}
                                >
                                    {dragInProgress && (
                                        <Box
                                            aria-hidden="true"
                                            onDragOver={handleEdgeDragOver}
                                            onDrop={handleDropAtEdge}
                                            sx={{
                                                position: 'absolute',
                                                top: -EDGE_DROP_ZONE_OUTSIDE_REACH,
                                                left: 0,
                                                right: 0,
                                                height: EDGE_DROP_ZONE_OUTSIDE_REACH + EDGE_DROP_ZONE_LIST_OVERLAP,
                                                zIndex: 1,
                                                backgroundColor: 'transparent',
                                                '&::before': dragEdge === 'top' ? {
                                                    content: '""',
                                                    position: 'absolute',
                                                    top: EDGE_DROP_ZONE_OUTSIDE_REACH,
                                                    left: 10,
                                                    right: 10,
                                                    height: 2,
                                                    borderRadius: 2,
                                                    backgroundColor: 'primary.main',
                                                    zIndex: 2,
                                                } : undefined,
                                            }}
                                        />
                                    )}
                                    <AnimatedTaskList
                                        items={taskListItems}
                                        renderItem={item => renderTaskList([item])}
                                        onAnimatingChange={setHomeTaskListAnimating}
                                        animateRemovals={focusVisibility !== 'fading' && focusVisibility !== 'sliding'}
                                        immediateRemovalTaskIds={pendingDeletedTaskIdSet}
                                        entrySource={taskReturnEntry}
                                        layoutVisibilityKey={collapsedGroupIds}
                                        layoutScope="today"
                                        layoutSnapshotRef={todayLayoutSnapshotRef}
                                    />
                                    {dragInProgress && (
                                        <Box
                                            aria-hidden="true"
                                            onDragOver={handleEdgeDragOver}
                                            onDrop={handleDropAtEdge}
                                            sx={{
                                                position: 'absolute',
                                                bottom: -EDGE_DROP_ZONE_OUTSIDE_REACH,
                                                left: 0,
                                                right: 0,
                                                height: EDGE_DROP_ZONE_OUTSIDE_REACH + EDGE_DROP_ZONE_LIST_OVERLAP,
                                                zIndex: 1,
                                                backgroundColor: 'transparent',
                                                '&::before': dragEdge === 'bottom' ? {
                                                    content: '""',
                                                    position: 'absolute',
                                                    bottom: EDGE_DROP_ZONE_OUTSIDE_REACH,
                                                    left: 10,
                                                    right: 10,
                                                    height: 2,
                                                    borderRadius: 2,
                                                    backgroundColor: 'primary.main',
                                                    zIndex: 2,
                                                } : undefined,
                                            }}
                                        />
                                    )}
                                </Box>
                            </Collapse>
                        </>
                    ) : homeContentReady && groups !== null ? (
                        <Box
                            onDragOver={(event) => {
                                if (!hasActiveDrag()) return;
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                                setDragTargetTaskId(null);
                                setDragTargetGroupId(null);
                                setDragTargetPosition(null);
                                setDragEdge(null);
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleDropAtTop();
                            }}
                            sx={{
                                position: 'relative',
                                display: 'block',
                                minHeight: 32,
                            }}
                        >
                            {todayCompletionMessage ?? (
                                <Typography variant="body1" color="text.secondary">
                                    Nothing scheduled for today.
                                </Typography>
                            )}
                        </Box>
                    ) : homeContentReady ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={20} aria-label="Loading task groups" />
                        </Box>
                    ) : null}

                    <Box id="home-completion-details">
                        <Collapse
                            in={showHomeSections && (focusVisibility === 'all' || focusVisibility === 'fading')}
                            timeout={focusVisibility === 'hidden' ? 0 : { enter: 260, exit: TASKS_FADE_DURATION_MS }}
                            mountOnEnter
                        >
                            <Box
                                id="today-events-section"
                                sx={{
                                    animation: focusVisibility === 'fading'
                                        ? `${tasksFadeAway} ${TASKS_FADE_DURATION_MS}ms ease-out forwards`
                                        : 'none',
                                }}
                            >
                                <TodayEventsSection />
                            </Box>
                        </Collapse>

                        <Collapse
                            in={homeTaskControlsReady && showHomeSections
                                && (focusVisibility === 'all' || focusVisibility === 'fading')
                                && showOlderTasks && olderTasks.length > 0}
                            timeout="auto"
                            mountOnEnter
                            unmountOnExit
                            onEntered={() => {
                                if (completionCardExpansionRef.current) {
                                    completionCardExpansionRef.current = false;
                                    return;
                                }
                                olderTasksSectionRef.current?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center',
                                });
                            }}
                        >
                            <Box
                                id="older-tasks-section"
                                ref={olderTasksSectionRef}
                                onClick={clearSelection}
                                sx={{
                                    mt: 2,
                                    pt: 1.25,
                                    borderTop: '1px solid',
                                    borderColor: 'divider',
                                    animation: focusVisibility === 'fading'
                                        ? `${tasksFadeAway} ${TASKS_FADE_DURATION_MS}ms ease-out forwards`
                                        : 'none',
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <HistoryIcon color="action" fontSize="small" />
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Older tasks
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled">
                                        {olderTasks.length}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                    <AnimatedTaskList
                                        items={olderTaskListItems}
                                        renderItem={item => renderTaskList([item], {
                                            reorderable: false,
                                            draggable: true,
                                            showScheduledDate: true,
                                        })}
                                        immediateRemovalTaskIds={pendingDeletedTaskIdSet}
                                        layoutVisibilityKey={collapsedGroupIds}
                                        layoutScope="older"
                                        layoutSnapshotRef={olderLayoutSnapshotRef}
                                    />
                                </Box>
                            </Box>
                        </Collapse>

                        <Collapse
                            in={homeTaskControlsReady && showHomeSections
                                && (focusVisibility === 'all' || focusVisibility === 'fading')
                                && (olderTasks.length > 0 || (focusedPomodoroTask !== null && tasksBelowFocus.length > 0))}
                            timeout={focusVisibility === 'hidden' ? 0 : { enter: 220, exit: 180 }}
                            mountOnEnter
                            unmountOnExit
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'center',
                                    gap: 0.5,
                                    mt: 2,
                                }}
                            >
                                {focusedPomodoroTask && tasksBelowFocus.length > 0 && (
                                    <Button
                                        variant="text"
                                        size="small"
                                        startIcon={<VisibilityOffIcon />}
                                        onClick={event => {
                                            event.stopPropagation();
                                            hideAllTasks();
                                        }}
                                    >
                                        Hide all tasks
                                    </Button>
                                )}
                                {olderTasks.length > 0 && (
                                    <Button
                                        variant="text"
                                        size="small"
                                        color={overdueCount > 0 ? 'warning' : 'inherit'}
                                        startIcon={<HistoryIcon />}
                                        onClick={event => {
                                            event.stopPropagation();
                                            toggleOlderTasks();
                                        }}
                                    >
                                        {showOlderTasks ? 'Hide older tasks' : `View older tasks (${olderTasks.length})`}
                                    </Button>
                                )}
                            </Box>
                        </Collapse>
                    </Box>
                </Box>

                <Popover
                    open={taskReminderEditor !== null}
                    onClose={() => setTaskReminderEditor(null)}
                    anchorReference="anchorPosition"
                    anchorPosition={taskReminderEditor
                        ? { top: taskReminderEditor.top, left: taskReminderEditor.left }
                        : undefined}
                    slotProps={{
                        paper: {
                            sx: {
                                p: 1.5,
                                width: 280,
                                maxWidth: 'calc(100vw - 32px)',
                                borderRadius: 2.5,
                            },
                        },
                    }}
                >
                    {taskReminderEditor && (() => {
                        const task = allTasks.find(item => item.taskId === taskReminderEditor.taskId);
                        if (!task) return null;
                        return (
                            <Box onClick={event => event.stopPropagation()}>
                                <Typography variant="subtitle2" sx={{ mb: 1.25 }} noWrap>
                                    {task.reminderMinutesBefore == null ? 'Add reminder' : 'Edit reminder'}
                                </Typography>
                                <TaskReminderPicker
                                    value={task.reminderMinutesBefore}
                                    scheduledAt={task.scheduledPerformDateTime}
                                    disabled={!task.scheduledPerformDateTime}
                                    onChange={reminderMinutesBefore => {
                                        void updateTask(task.taskId, { reminderMinutesBefore });
                                    }}
                                />
                                {!task.scheduledPerformDateTime && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                        Schedule this task first to add a reminder.
                                    </Typography>
                                )}
                                {task.reminderMinutesBefore != null && (
                                    <Button
                                        size="small"
                                        color="error"
                                        sx={{ mt: 1.25 }}
                                        onClick={() => void updateTask(task.taskId, { reminderMinutesBefore: null })}
                                    >
                                        Delete reminder
                                    </Button>
                                )}
                            </Box>
                        );
                    })()}
                </Popover>

                <Menu
                    open={taskContextMenu !== null}
                    onClose={() => setTaskContextMenu(null)}
                    anchorReference="anchorPosition"
                    anchorPosition={taskContextMenu
                        ? { top: taskContextMenu.top, left: taskContextMenu.left }
                        : undefined}
                    MenuListProps={{ dense: true }}
                >
                    {taskContextMenu && (
                        <>
                            <MenuItem onClick={() => {
                                const menu = taskContextMenu;
                                setTaskContextMenu(null);
                                window.setTimeout(() => setTaskReminderEditor({
                                    taskId: menu.task.taskId,
                                    top: menu.top,
                                    left: menu.left,
                                }), 0);
                            }}>
                                <ListItemIcon><NotificationsNoneIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>
                                    {taskContextMenu.task.reminderMinutesBefore == null
                                        ? 'Add reminder'
                                        : 'Edit reminder'}
                                </ListItemText>
                            </MenuItem>
                            <MenuItem onClick={() => {
                                const menu = taskContextMenu;
                                setTaskContextMenu(null);
                                deleteTask(menu.task, menu.anchorEl);
                            }} sx={{
                                '&:hover': {
                                    color: 'error.main',
                                    '& .MuiListItemIcon-root': { color: 'inherit' },
                                },
                            }}>
                                <ListItemIcon><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Delete task</ListItemText>
                            </MenuItem>
                        </>
                    )}
                </Menu>

                <Popover
                    open={deleteRequest !== null}
                    anchorEl={deleteRequest?.anchorEl}
                    onClose={closeDeleteRequest}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    slotProps={{
                        paper: {
                            sx: {
                                p: 1.5,
                                width: deleteRequest && requestHasRecurringTasks(deleteRequest)
                                    ? deleteRequest.kind === 'group' ? 480 : 380
                                    : 270,
                                maxWidth: 'calc(100vw - 32px)',
                                borderRadius: 2.5,
                            },
                        },
                    }}
                >
                    {deleteRequest && (
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1.25 }}>
                                {deleteRequest.kind === 'group'
                                    ? `Delete “${deleteRequest.group.name}” and its ${deleteRequest.tasks.length} task${deleteRequest.tasks.length === 1 ? '' : 's'}?`
                                    : deleteRequest.kind === 'bulk'
                                        ? `Delete ${deleteRequest.tasks.length} selected task${deleteRequest.tasks.length > 1 ? 's' : ''}?`
                                        : deleteRequest.tasks[0].taskSeriesId
                                            ? `Choose which occurrences of “${deleteRequest.tasks[0].name}” to delete?`
                                            : `Delete “${deleteRequest.tasks[0].name}” and its subtasks?`}
                            </Typography>
                            {requestHasRecurringTasks(deleteRequest) ? (
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: deleteRequest.kind === 'group'
                                            ? 'repeat(3, minmax(0, 1fr))'
                                            : 'repeat(2, minmax(0, 1fr))',
                                        gap: 0.5,
                                        '& .MuiButton-root': {
                                            width: '100%',
                                            minWidth: 0,
                                            minHeight: 38,
                                            px: 0.75,
                                            py: 0.5,
                                            lineHeight: 1.2,
                                            whiteSpace: 'normal',
                                        },
                                    }}
                                >
                                    <Button
                                        size="small"
                                        onClick={() => void confirmDelete('occurrence')}
                                        disabled={deleteSubmitting}
                                    >
                                        {deleteRequest.kind === 'single' ? 'This occurrence' : 'Selected occurrences'}
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={() => void confirmDelete('future')}
                                        disabled={deleteSubmitting}
                                    >
                                        Future occurrences
                                    </Button>
                                    {deleteRequest.kind !== 'group' && (
                                        <Button size="small" onClick={closeDeleteRequest} disabled={deleteSubmitting}>
                                            Cancel
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        color="error"
                                        variant="contained"
                                        onClick={() => void confirmDelete('series')}
                                        disabled={deleteSubmitting}
                                    >
                                        {deleteSubmitting ? 'Deleting…' : 'Delete series'}
                                    </Button>
                                    {deleteRequest.kind === 'group' && (
                                        <Button size="small" onClick={() => void confirmUngroup()} disabled={deleteSubmitting}>
                                            Ungroup
                                        </Button>
                                    )}
                                    {deleteRequest.kind === 'group' && (
                                        <Button size="small" onClick={closeDeleteRequest} disabled={deleteSubmitting}>
                                            Cancel
                                        </Button>
                                    )}
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5 }}>
                                    <Button size="small" onClick={closeDeleteRequest} disabled={deleteSubmitting}>
                                        Cancel
                                    </Button>
                                    {deleteRequest.kind === 'group' && (
                                        <Button size="small" onClick={() => void confirmUngroup()} disabled={deleteSubmitting}>
                                            Ungroup
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        color="error"
                                        variant="contained"
                                        onClick={() => void confirmDelete()}
                                        disabled={deleteSubmitting}
                                    >
                                        {deleteSubmitting ? <CircularProgress size={16} color="inherit" /> : 'Delete'}
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}
                </Popover>

                <Popover
                    open={Boolean(groupAnchorEl)}
                    anchorEl={groupAnchorEl}
                    onClose={() => {
                        if (!groupSubmitting) {
                            setGroupAnchorEl(null);
                            setGroupName('');
                        }
                    }}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    slotProps={{
                        paper: {
                            sx: {
                                p: 1.25,
                                width: 260,
                            },
                        },
                    }}
                >
                    <Box
                        component="form"
                        onSubmit={event => {
                            event.preventDefault();
                            void createGroup();
                        }}
                        onClick={event => event.stopPropagation()}
                    >
                        <TextField
                            autoFocus
                            autoComplete="off"
                            fullWidth
                            size="small"
                            label="Group name"
                            placeholder="Morning routine"
                            value={groupName}
                            onChange={event => setGroupName(event.target.value)}
                            onFocus={event => event.currentTarget.select()}
                            disabled={groupSubmitting}
                        />
                    </Box>
                </Popover>

                <TaskParentPopover
                    anchorEl={parentTaskAnchorEl}
                    selectedCount={selectedTaskIds.length}
                    submitting={parentTaskSubmitting}
                    onClose={() => setParentTaskAnchorEl(null)}
                    onSubmit={createParentTask}
                />

                <BulkTaskDatePopover
                    anchorEl={bulkDateAnchorEl}
                    value={bulkDateDraft}
                    loading={bulkActionLoading}
                    onChange={setBulkDateDraft}
                    onClose={() => setBulkDateAnchorEl(null)}
                    onClear={() => void performBulkAction('clear-date')}
                    onApply={() => void performBulkAction('move-to-date', formatLocalDateTime(bulkDateDraft))}
                />

                <Snackbar
                    key={taskFeedback?.id}
                    open={taskFeedback !== null}
                    autoHideDuration={taskFeedback?.undo ? 5000 : 2000}
                    onClose={(_, reason) => {
                        if (reason !== 'clickaway') setTaskFeedback(null);
                    }}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    TransitionComponent={SlideFromRight}
                    sx={{
                        right: { xs: 12, sm: 28 },
                        bottom: { xs: 12, sm: 28 },
                    }}
                >
                    {taskFeedback ? (
                        <Alert
                            severity={taskFeedback.severity}
                            variant="outlined"
                            icon={<InfoOutlinedIcon fontSize="small" />}
                            action={taskFeedback.undo ? (
                                <Button
                                    size="small"
                                    color="inherit"
                                    startIcon={<ReplayIcon fontSize="small" />}
                                    onClick={() => void undoTaskFeedback()}
                                    sx={{ whiteSpace: 'nowrap' }}
                                >
                                    Undo
                                </Button>
                            ) : undefined}
                            onClose={() => setTaskFeedback(null)}
                            sx={{
                                position: 'relative',
                                minWidth: 240,
                                maxWidth: 'calc(100vw - 48px)',
                                boxSizing: 'border-box',
                                alignItems: 'center',
                                backgroundColor: 'background.paper',
                                px: 1.5,
                                py: 0.5,
                                '& .MuiAlert-message': {
                                    flex: '1 1 auto',
                                    minWidth: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    py: 0.25,
                                    fontSize: '0.85rem',
                                },
                                '& .MuiAlert-action': {
                                    position: 'static',
                                    flex: '0 0 auto',
                                    alignSelf: 'center',
                                    p: 0,
                                    m: 0,
                                    ml: 1,
                                },
                            }}
                        >
                            {taskFeedback.message}
                        </Alert>
                    ) : undefined}
                </Snackbar>

            </Box>
        </PageWrapper>
    );
}

export default HomePage;
