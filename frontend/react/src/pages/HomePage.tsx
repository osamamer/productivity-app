import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Alert,
    IconButton,
    Popover,
    Slide,
    Snackbar,
    TextField,
    Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import HistoryIcon from '@mui/icons-material/History';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ReplayIcon from '@mui/icons-material/Replay';
import { taskGroupService, taskService } from '../services/api';
import { Task } from '../types/Task';
import { TaskGroup } from '../types/TaskGroup';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../hooks/useGlobalTasks';
import { useUser } from '../hooks/useUser';
import { SmartTaskInput } from '../components/input/SmartTaskInput';
import { FlatTaskRow } from '../components/FlatTaskRow';
import { TaskToCreate } from '../types/TaskToCreate';
import { DayWidget } from '../components/DayWidget';
import { getShowCompletedHomeTasks } from '../services/utils/homePreferences';
import { PomodoroStatus } from '../types/PomodoroStatus';
import { celebrateStatLogged } from '../services/statCelebration';

type ActiveExpansion = { taskId: string; panel: 'pomodoro' | 'details' } | null;
type FocusVisibility = 'all' | 'fading' | 'sliding' | 'hidden' | 'revealing';
type DropEdge = 'before' | 'after';
type GroupDropIntent = DropEdge | 'inside';
type BulkAction = 'complete' | 'reopen' | 'move-to-today';
type DeleteRequest = { kind: 'single' | 'bulk'; tasks: Task[]; anchorEl: HTMLElement };
type TaskFeedback = { id: number; severity: 'success' | 'error'; message: string };
type TaskListItem =
    | { kind: 'task'; task: Task }
    | { kind: 'group'; group: TaskGroup; tasks: Task[] };

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
        transform: translateY(var(--focus-task-offset, 0px));
    }
    to {
        transform: translateY(0);
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

const TASKS_FADE_DURATION_MS = 140;
const FOCUS_TASK_SLIDE_DURATION_MS = 650;
const SELECTION_ACTIONS_EDGE_PADDING = 12;
const SELECTION_ACTIONS_GAP = 12;
const SELECTION_ACTIONS_FALLBACK_WIDTH = 136;

const groupReveal = keyframes`
    from {
        opacity: 0;
        transform: translateY(-5px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

const SlideFromRight = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof Slide>>(
    (props, ref) => <Slide {...props} ref={ref} direction="left" />,
);
SlideFromRight.displayName = 'SlideFromRight';

function buildTaskListItems(tasks: Task[], groups: TaskGroup[]): TaskListItem[] {
    const visibleTaskIds = new Set(tasks.map(task => task.taskId));
    const groupByTaskId = new Map<string, TaskGroup>();

    [...groups]
        .sort((first, second) => first.displayOrder - second.displayOrder)
        .forEach(group => {
            group.taskIds.forEach(taskId => {
                if (visibleTaskIds.has(taskId) && !groupByTaskId.has(taskId)) {
                    groupByTaskId.set(taskId, group);
                }
            });
        });

    const emittedGroupIds = new Set<string>();
    const items: TaskListItem[] = [];

    tasks.forEach(task => {
        const group = groupByTaskId.get(task.taskId);
        if (!group) {
            items.push({ kind: 'task', task });
            return;
        }
        if (emittedGroupIds.has(group.groupId)) return;

        emittedGroupIds.add(group.groupId);
        items.push({
            kind: 'group',
            group,
            tasks: tasks.filter(candidate => groupByTaskId.get(candidate.taskId)?.groupId === group.groupId),
        });
    });

    return items;
}

function taskListItemId(item: TaskListItem): string {
    return item.kind === 'task' ? `task:${item.task.taskId}` : `group:${item.group.groupId}`;
}

function taskDropEdge(event: React.DragEvent<HTMLElement>): DropEdge {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
}

function groupDropIntent(event: React.DragEvent<HTMLElement>): GroupDropIntent {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    if (relativeY < 0.32) return 'before';
    if (relativeY > 0.68) return 'after';
    return 'inside';
}

type AnimatedTaskListProps = {
    items: TaskListItem[];
    renderItem: (item: TaskListItem) => React.ReactNode;
};

const OLDER_TASK_EXIT_DURATION_MS = 180;

function AnimatedTaskList({ items, renderItem }: AnimatedTaskListProps) {
    const [displayedItems, setDisplayedItems] = useState(items);
    const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(() => new Set());
    const displayedItemsRef = useRef(items);
    const currentItemIdsRef = useRef(new Set(items.map(taskListItemId)));
    const exitingItemIdsRef = useRef(new Set<string>());
    const exitTimersRef = useRef(new Map<string, number>());

    useEffect(() => {
        const nextItemIds = new Set(items.map(taskListItemId));
        const nextItemsById = new Map(items.map(item => [taskListItemId(item), item]));
        const previousItems = displayedItemsRef.current;
        const previousItemIds = new Set(previousItems.map(taskListItemId));
        const removedItems = previousItems.filter(item => !nextItemIds.has(taskListItemId(item)));
        const reappearedItemIds = items
            .map(taskListItemId)
            .filter(itemId => exitingItemIdsRef.current.has(itemId));

        currentItemIdsRef.current = nextItemIds;
        reappearedItemIds.forEach(itemId => {
            const timerId = exitTimersRef.current.get(itemId);
            if (timerId !== undefined) window.clearTimeout(timerId);
            exitTimersRef.current.delete(itemId);
            exitingItemIdsRef.current.delete(itemId);
        });
        if (reappearedItemIds.length > 0) {
            setExitingItemIds(new Set(exitingItemIdsRef.current));
        }

        const mergedItems = [
            ...previousItems.map(item => nextItemsById.get(taskListItemId(item)) ?? item),
            ...items.filter(item => !previousItemIds.has(taskListItemId(item))),
        ];
        displayedItemsRef.current = mergedItems;
        if (mergedItems.length !== previousItems.length
            || mergedItems.some((item, index) => item !== previousItems[index])) {
            setDisplayedItems(mergedItems);
        }

        const newlyRemovedItems = removedItems.filter(item => !exitingItemIdsRef.current.has(taskListItemId(item)));
        if (newlyRemovedItems.length > 0) {
            newlyRemovedItems.forEach(item => {
                const itemId = taskListItemId(item);
                exitingItemIdsRef.current.add(itemId);
                const timerId = window.setTimeout(() => {
                    exitTimersRef.current.delete(itemId);
                    if (currentItemIdsRef.current.has(itemId)) return;

                    exitingItemIdsRef.current.delete(itemId);
                    setExitingItemIds(new Set(exitingItemIdsRef.current));
                    const remainingItems = displayedItemsRef.current.filter(
                        displayedItem => taskListItemId(displayedItem) !== itemId,
                    );
                    displayedItemsRef.current = remainingItems;
                    setDisplayedItems(remainingItems);
                }, OLDER_TASK_EXIT_DURATION_MS);
                exitTimersRef.current.set(itemId, timerId);
            });
            setExitingItemIds(new Set(exitingItemIdsRef.current));
        }
    }, [items]);

    useEffect(() => () => {
        exitTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
    }, []);

    return (
        <>
            {displayedItems.map(item => {
                const itemId = taskListItemId(item);
                return (
                    <Collapse
                        key={itemId}
                        in={!exitingItemIds.has(itemId)}
                        timeout={OLDER_TASK_EXIT_DURATION_MS}
                        unmountOnExit
                    >
                        <Box>{renderItem(item)}</Box>
                    </Collapse>
                );
            })}
        </>
    );
}

function formatLocalDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
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

export function HomePage() {
    const { user } = useUser();
    const [activeExpansion, setActiveExpansion] = useState<ActiveExpansion>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [selectionActionsPosition, setSelectionActionsPosition] = useState<{ top: number; left: number } | null>(null);
    const [taskFeedback, setTaskFeedback] = useState<TaskFeedback | null>(null);
    const [showOlderTasks, setShowOlderTasks] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupSubmitting, setGroupSubmitting] = useState(false);
    const [groupAddingTaskId, setGroupAddingTaskId] = useState<string | null>(null);
    const [groupTaskDraft, setGroupTaskDraft] = useState('');
    const [groupTaskSubmitting, setGroupTaskSubmitting] = useState(false);
    const [groups, setGroups] = useState<TaskGroup[] | null>(null);
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [draggedTaskIds, setDraggedTaskIds] = useState<string[]>([]);
    const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
    const [dragTargetTaskId, setDragTargetTaskId] = useState<string | null>(null);
    const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
    const [dragTargetPosition, setDragTargetPosition] = useState<GroupDropIntent | null>(null);
    const [dragTargetTop, setDragTargetTop] = useState(false);
    const [dragTargetBottom, setDragTargetBottom] = useState(false);
    const [activePomodoroTaskId, setActivePomodoroTaskId] = useState<string | null>(null);
    const [initialPomodoroStatus, setInitialPomodoroStatus] = useState<PomodoroStatus | null>(null);
    const [pomodoroStatusResolved, setPomodoroStatusResolved] = useState(false);
    const [pomodoroTaskMinimized, setPomodoroTaskMinimized] = useState(false);
    const [focusVisibility, setFocusVisibility] = useState<FocusVisibility>('all');
    const [focusTaskOffset, setFocusTaskOffset] = useState(0);
    const selectionAnchorRef = useRef<string | null>(null);
    const activePomodoroTaskIdRef = useRef<string | null>(null);
    const focusVisibilityRef = useRef<FocusVisibility>('all');
    const focusTaskSourceTopRef = useRef<number | null>(null);
    const latestPomodoroStatusRef = useRef<PomodoroStatus | null>(null);
    const taskListTopRef = useRef<HTMLDivElement | null>(null);
    const selectionActionsRef = useRef<HTMLDivElement | null>(null);
    const taskFeedbackIdRef = useRef(0);
    const focusTransitionTimerRef = useRef<number | null>(null);
    const temporarilyCollapsedGroupIdRef = useRef<string | null>(null);
    const groupTaskSubmissionRef = useRef(false);

    const showTaskFeedback = useCallback((severity: TaskFeedback['severity'], message: string) => {
        taskFeedbackIdRef.current += 1;
        setTaskFeedback({ id: taskFeedbackIdRef.current, severity, message });
    }, []);

    const {
        allTasks,
        todayTasks,
        pastTasks,
        refreshTaskBuckets,
        addTaskToState,
        updateTaskInState,
        removeTaskFromState,
        reorderTasksInState,
    } = useGlobalTasks();

    const visibleTasks = useMemo(
        () => todayTasks.filter(task => !task.parentId && (getShowCompletedHomeTasks() || !task.completed)),
        [todayTasks],
    );
    const olderTasks = useMemo(
        () => pastTasks.filter(task => !task.parentId && (getShowCompletedHomeTasks() || !task.completed)),
        [pastTasks],
    );
    const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
    const selectedTasks = useMemo(
        () => allTasks.filter(task => selectedTaskIdSet.has(task.taskId)),
        [allTasks, selectedTaskIdSet],
    );
    const olderTaskIdSet = useMemo(() => new Set(olderTasks.map(task => task.taskId)), [olderTasks]);
    const selectedOlderTasks = useMemo(
        () => selectedTasks.filter(task => olderTaskIdSet.has(task.taskId)),
        [olderTaskIdSet, selectedTasks],
    );
    const activePomodoroTask = useMemo(
        () => visibleTasks.find(task => task.taskId === activePomodoroTaskId) ?? null,
        [activePomodoroTaskId, visibleTasks],
    );
    const focusedPomodoroTask = useMemo(
        () => pomodoroTaskMinimized ? null : activePomodoroTask,
        [activePomodoroTask, pomodoroTaskMinimized],
    );
    const tasksBelowFocus = useMemo(
        () => focusedPomodoroTask
            ? visibleTasks.filter(task => task.taskId !== focusedPomodoroTask.taskId)
            : visibleTasks,
        [focusedPomodoroTask, visibleTasks],
    );
    const tasksInTransition = focusVisibility === 'fading' ? visibleTasks : tasksBelowFocus;
    const taskListItems = useMemo(
        () => buildTaskListItems(tasksInTransition, groups ?? []),
        [groups, tasksInTransition],
    );
    const olderTaskListItems = useMemo(
        () => buildTaskListItems(olderTasks, groups ?? []),
        [groups, olderTasks],
    );
    const renderedTaskIds = useMemo(() => {
        const taskIds = focusedPomodoroTask ? [focusedPomodoroTask.taskId] : [];
        taskListItems.forEach(item => {
            if (item.kind === 'task') {
                taskIds.push(item.task.taskId);
            } else if (!collapsedGroupIds.has(item.group.groupId)) {
                taskIds.push(...item.tasks.map(task => task.taskId));
            }
        });
        if (showOlderTasks) {
            olderTaskListItems.forEach(item => {
                if (item.kind === 'task') {
                    taskIds.push(item.task.taskId);
                } else if (!collapsedGroupIds.has(item.group.groupId)) {
                    taskIds.push(...item.tasks.map(task => task.taskId));
                }
            });
        }
        return taskIds;
    }, [focusedPomodoroTask, collapsedGroupIds, olderTaskListItems, showOlderTasks, taskListItems]);

    const updateSelectionActionsPosition = useCallback(() => {
        if (selectedTaskIds.length < 2) {
            setSelectionActionsPosition(null);
            return;
        }

        const selectedRows = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
            .filter(row => selectedTaskIdSet.has(row.dataset.taskId ?? ''));
        if (selectedRows.length === 0) {
            setSelectionActionsPosition(null);
            return;
        }

        const bounds = selectedRows.map(row => row.getBoundingClientRect());
        const top = Math.min(...bounds.map(rect => rect.top));
        const bottom = Math.max(...bounds.map(rect => rect.bottom));
        const right = Math.max(...bounds.map(rect => rect.right));
        const popupWidth = selectionActionsRef.current?.getBoundingClientRect().width
            ?? SELECTION_ACTIONS_FALLBACK_WIDTH;
        const maxLeft = window.innerWidth - popupWidth - SELECTION_ACTIONS_EDGE_PADDING;
        const left = Math.min(
            Math.max(right + SELECTION_ACTIONS_GAP, SELECTION_ACTIONS_EDGE_PADDING),
            Math.max(SELECTION_ACTIONS_EDGE_PADDING, maxLeft),
        );
        const nextPosition = {
            top: Math.round((top + bottom) / 2),
            left: Math.round(left),
        };

        setSelectionActionsPosition(previous => (
            previous?.top === nextPosition.top && previous.left === nextPosition.left
                ? previous
                : nextPosition
        ));
    }, [selectedTaskIdSet, selectedTaskIds.length]);

    useLayoutEffect(() => {
        if (selectedTaskIds.length < 2) {
            setSelectionActionsPosition(previous => previous === null ? previous : null);
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
                if (selectedTaskIdSet.has(row.dataset.taskId ?? '')) resizeObserver.observe(row);
            });
        }

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
            resizeObserver?.disconnect();
        };
    }, [activeExpansion, collapsedGroupIds, focusVisibility, groups, olderTasks, selectedTaskIdSet,
        selectedTaskIds.length, showOlderTasks, updateSelectionActionsPosition, visibleTasks]);

    const clearFocusTransitionTimer = useCallback(() => {
        if (focusTransitionTimerRef.current !== null) {
            window.clearTimeout(focusTransitionTimerRef.current);
            focusTransitionTimerRef.current = null;
        }
    }, []);

    const rememberFocusTaskPosition = useCallback((taskId: string) => {
        const taskRow = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
            .find(element => element.dataset.taskId === taskId);
        focusTaskSourceTopRef.current = taskRow?.getBoundingClientRect().top ?? null;
    }, []);

    const finishFocusTransition = useCallback(() => {
        const sourceTop = focusTaskSourceTopRef.current;
        const targetTop = taskListTopRef.current?.getBoundingClientRect().top;
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
            setGroups(fetchedGroups);
            setCollapsedGroupIds(new Set(fetchedGroups.map(group => group.groupId)));
        } catch (err) {
            console.error('Error fetching task groups:', err);
            setGroups([]);
        }
    }, []);

    useEffect(() => {
        void refreshGroups();
    }, [refreshGroups]);

    useEffect(() => () => clearFocusTransitionTimer(), [clearFocusTransitionTimer]);

    useEffect(() => {
        focusVisibilityRef.current = focusVisibility;
    }, [focusVisibility]);

    async function createTask(task: TaskToCreate) {
        try {
            const created = await taskService.createTask(task);
            addTaskToState(created);
        } catch (err) {
            console.error('Error creating task:', err);
            await refreshTaskBuckets(true);
        }
    }

    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
        const originalTask = allTasks.find(task => task.taskId === taskId);
        updateTaskInState(taskId, updates);
        try {
            await taskService.updateTask(taskId, updates);
        } catch (err) {
            console.error('Error updating task:', err);
            if (originalTask) updateTaskInState(taskId, originalTask);
            await refreshTaskBuckets(true);
        }
    }, [allTasks, refreshTaskBuckets, updateTaskInState]);

    const toggleTaskCompletion = useCallback(async (taskId: string, anchorEl?: HTMLElement) => {
        const task = allTasks.find(existingTask => existingTask.taskId === taskId);
        const wasCompleted = task?.completed ?? false;
        const completionOrigin = !wasCompleted ? anchorEl?.getBoundingClientRect() : undefined;
        if (task) updateTaskInState(taskId, { completed: !task.completed });
        try {
            const updatedTask = await taskService.toggleTaskCompletion(taskId, task ? !task.completed : undefined);
            if (!wasCompleted && updatedTask.completed) {
                celebrateStatLogged(completionOrigin ?? anchorEl);
                showTaskFeedback('success', 'Task completed');
            }
        } catch (err) {
            console.error('Error toggling task:', err);
            if (task) updateTaskInState(taskId, { completed: task.completed });
        }
    }, [allTasks, showTaskFeedback, updateTaskInState]);

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

    function requestBulkDelete(anchorEl: HTMLElement) {
        if (bulkActionLoading || selectedTasks.length === 0) return;
        setDeleteRequest({ kind: 'bulk', tasks: selectedTasks, anchorEl });
    }

    function closeDeleteRequest() {
        if (!deleteSubmitting) setDeleteRequest(null);
    }

    async function confirmDelete() {
        if (!deleteRequest || deleteSubmitting) return;

        const request = deleteRequest;
        setDeleteSubmitting(true);
        setDeleteRequest(null);
        if (request.kind === 'bulk') setBulkActionLoading(true);
        try {
            await Promise.all(request.tasks.map(task => taskService.deleteTask(task.taskId)));
            request.tasks.forEach(task => removeTaskFromState(task.taskId));
            removeTasksFromGroups(request.tasks.map(task => task.taskId));
            showTaskFeedback(
                'error',
                request.kind === 'bulk'
                    ? `${request.tasks.length} tasks deleted`
                    : 'Task deleted',
            );
            if (request.kind === 'bulk') {
                clearSelection();
            } else {
                const [task] = request.tasks;
                setSelectedTaskIds(previous => previous.filter(taskId => taskId !== task.taskId));
                setActiveExpansion(previous => previous?.taskId === task.taskId ? null : previous);
            }
        } catch (err) {
            console.error(`Error deleting ${request.kind === 'bulk' ? 'selected tasks' : 'task'}:`, err);
            await refreshTaskBuckets(true);
        } finally {
            setDeleteSubmitting(false);
            if (request.kind === 'bulk') setBulkActionLoading(false);
            setDeleteRequest(null);
        }
    }

    async function performBulkAction(action: BulkAction) {
        const tasksToUpdate = action === 'move-to-today' ? selectedOlderTasks : selectedTasks;
        if (bulkActionLoading || tasksToUpdate.length === 0) return;
        const tasksToCelebrate = action === 'complete'
            ? tasksToUpdate.filter(task => !task.completed)
            : [];
        const completionOrigins = tasksToCelebrate
            .flatMap(task => Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
                .filter(row => row.dataset.taskId === task.taskId)
                .map(row => row.getBoundingClientRect()));

        setBulkActionLoading(true);
        try {
            const updatedTasks = await Promise.all(tasksToUpdate.map(task => {
                if (action === 'move-to-today') {
                    return taskService.updateTask(task.taskId, {
                        scheduledPerformDateTime: moveTaskDateToToday(task),
                    });
                }

                return taskService.updateTask(task.taskId, {
                    completed: action === 'complete',
                });
            }));
            updatedTasks.forEach(updatedTask => updateTaskInState(updatedTask.taskId, updatedTask));
            if (action === 'complete' && tasksToCelebrate.length > 0) {
                completionOrigins.forEach(origin => celebrateStatLogged(origin));
                showTaskFeedback(
                    'success',
                    `${tasksToCelebrate.length} task${tasksToCelebrate.length === 1 ? '' : 's'} completed`,
                );
            }
            clearSelection();
        } catch (err) {
            console.error(`Error applying bulk task action (${action}):`, err);
            await refreshTaskBuckets(true);
        } finally {
            setBulkActionLoading(false);
        }
    }

    function toggleOlderTasks() {
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

    const handleAutoExpand = useCallback((taskId: string, panel: 'pomodoro') => {
        setActiveExpansion(previous => (
            previous?.taskId === taskId && previous.panel === panel
                ? previous
                : { taskId, panel }
        ));
    }, []);

    const handleTaskSelection = useCallback((task: Task, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        const taskId = task.taskId;
        const anchorId = selectionAnchorRef.current;

        if (event.shiftKey && anchorId) {
            const anchorIndex = renderedTaskIds.indexOf(anchorId);
            const taskIndex = renderedTaskIds.indexOf(taskId);
            if (anchorIndex !== -1 && taskIndex !== -1) {
                const rangeStart = Math.min(anchorIndex, taskIndex);
                const rangeEnd = Math.max(anchorIndex, taskIndex);
                const rangeIds = renderedTaskIds.slice(rangeStart, rangeEnd + 1);
                setSelectedTaskIds(previous => [...new Set([...previous, ...rangeIds])]);
                return;
            }
        }

        if (event.ctrlKey || event.metaKey) {
            setSelectedTaskIds(previous => previous.includes(taskId)
                ? previous.filter(selectedTaskId => selectedTaskId !== taskId)
                : [...previous, taskId]);
            selectionAnchorRef.current = taskId;
            return;
        }

        setSelectedTaskIds([taskId]);
        selectionAnchorRef.current = taskId;
    }, [renderedTaskIds]);

    const handlePomodoroActiveChange = useCallback((
        taskId: string,
        active: boolean,
        options?: { animate?: boolean },
    ) => {
        if (active) {
            if (activePomodoroTaskIdRef.current === taskId) return;

            clearFocusTransitionTimer();
            rememberFocusTaskPosition(taskId);
            activePomodoroTaskIdRef.current = taskId;
            setActivePomodoroTaskId(taskId);
            setPomodoroTaskMinimized(false);
            setSelectedTaskIds([]);
            setShowOlderTasks(false);
            if (options?.animate === false) {
                setFocusVisibility('hidden');
                return;
            }

            setFocusVisibility('fading');
            focusTransitionTimerRef.current = window.setTimeout(
                finishFocusTransition,
                TASKS_FADE_DURATION_MS,
            );
            return;
        }

        clearFocusTransitionTimer();
        setFocusVisibility('all');
        setActiveExpansion(previous =>
            previous?.taskId === taskId && previous.panel === 'pomodoro' ? null : previous,
        );

        if (activePomodoroTaskIdRef.current !== taskId) return;

        activePomodoroTaskIdRef.current = null;
        latestPomodoroStatusRef.current = null;
        setActivePomodoroTaskId(null);
        setInitialPomodoroStatus(null);
        setPomodoroTaskMinimized(false);
        setFocusVisibility('all');
    }, [clearFocusTransitionTimer, finishFocusTransition, rememberFocusTaskPosition]);

    useEffect(() => {
        let cancelled = false;
        taskService.getActivePomodoro()
            .then(status => {
                if (cancelled || !status?.active) return;
                latestPomodoroStatusRef.current = status;
                setInitialPomodoroStatus(status);
                handlePomodoroActiveChange(status.associatedTaskId, true, { animate: false });
            })
            .catch(error => console.error('Error checking active pomodoro:', error))
            .finally(() => {
                if (!cancelled) setPomodoroStatusResolved(true);
            });

        return () => {
            cancelled = true;
        };
    }, [handlePomodoroActiveChange]);

    const handlePomodoroFocusStart = useCallback((taskId: string) => {
        if (activePomodoroTaskIdRef.current !== taskId) return;
        if (pomodoroTaskMinimized) return;
        if (
            focusVisibilityRef.current === 'hidden'
            || focusVisibilityRef.current === 'fading'
            || focusVisibilityRef.current === 'sliding'
        ) return;

        clearFocusTransitionTimer();
        rememberFocusTaskPosition(taskId);
        setShowOlderTasks(false);
        setFocusVisibility('fading');
        focusTransitionTimerRef.current = window.setTimeout(
            finishFocusTransition,
            TASKS_FADE_DURATION_MS,
        );
    }, [clearFocusTransitionTimer, finishFocusTransition, pomodoroTaskMinimized, rememberFocusTaskPosition]);

    const handlePomodoroStatusChange = useCallback((taskId: string, status: PomodoroStatus) => {
        const activeTaskId = activePomodoroTaskIdRef.current;
        if (activeTaskId === null || activeTaskId === taskId) {
            latestPomodoroStatusRef.current = status;
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

    const minimizePomodoroTask = useCallback((taskId: string) => {
        if (activePomodoroTaskIdRef.current !== taskId) return;

        clearFocusTransitionTimer();
        setActiveExpansion(null);
        setPomodoroTaskMinimized(true);
        setFocusVisibility('all');
    }, [clearFocusTransitionTimer]);

    const finishDragging = useCallback(() => {
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
        setDragTargetTop(false);
        setDragTargetBottom(false);
    }, []);

    const persistTaskOrder = useCallback((orderedTaskIds: string[]) => {
        reorderTasksInState(orderedTaskIds);
        taskService.reorderTasks(orderedTaskIds).catch(err => {
            console.error('Error reordering tasks:', err);
            refreshTaskBuckets(true);
        });
    }, [refreshTaskBuckets, reorderTasksInState]);

    const placeTasksAfterGroup = useCallback((targetGroup: TaskGroup, taskIds: string[]) => {
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
        persistTaskOrder(orderWithoutAddedTasks);
    }, [allTasks, persistTaskOrder]);

    const moveTasksToToday = useCallback(async (taskIds: string[]) => {
        const olderTaskIdSet = new Set(olderTasks.map(task => task.taskId));
        const tasksToMove = allTasks.filter(task => taskIds.includes(task.taskId) && olderTaskIdSet.has(task.taskId));
        if (tasksToMove.length === 0) return;

        const updates = tasksToMove.map(task => ({
            task,
            scheduledPerformDateTime: moveTaskDateToToday(task),
        }));
        updates.forEach(({ task, scheduledPerformDateTime }) => {
            updateTaskInState(task.taskId, { scheduledPerformDateTime });
        });

        try {
            const updatedTasks = await Promise.all(updates.map(({ task, scheduledPerformDateTime }) =>
                taskService.updateTask(task.taskId, { scheduledPerformDateTime }),
            ));
            updatedTasks.forEach(updatedTask => updateTaskInState(updatedTask.taskId, updatedTask));
        } catch (err) {
            console.error('Error moving dragged tasks to today:', err);
            await refreshTaskBuckets(true);
        }
    }, [allTasks, olderTasks, refreshTaskBuckets, updateTaskInState]);

    const moveDraggedOlderTasksToToday = useCallback(() => {
        const draggedIds = draggedTaskIds.length > 0
            ? draggedTaskIds
            : draggedTaskId ? [draggedTaskId] : [];
        const olderTaskIdSet = new Set(olderTasks.map(task => task.taskId));
        const draggedOlderTaskIds = draggedIds.filter(taskId => olderTaskIdSet.has(taskId));
        if (draggedOlderTaskIds.length === 0) return false;

        void moveTasksToToday(draggedOlderTaskIds);
        finishDragging();
        return true;
    }, [draggedTaskId, draggedTaskIds, finishDragging, moveTasksToToday, olderTasks]);

    const applyUpdatedGroup = useCallback((updatedGroup: TaskGroup, movedTaskIds: string[]) => {
        const movedTaskIdSet = new Set(movedTaskIds);
        setGroups(previous => (previous ?? [])
            .map(group => group.groupId === updatedGroup.groupId
                ? updatedGroup
                : { ...group, taskIds: group.taskIds.filter(taskId => !movedTaskIdSet.has(taskId)) })
            .filter(group => group.taskIds.length >= 2));
    }, []);

    const addTasksToGroup = useCallback(async (targetGroup: TaskGroup, taskIds: string[]) => {
        const taskIdsToAdd = taskIds.filter(taskId => !targetGroup.taskIds.includes(taskId));
        if (taskIdsToAdd.length === 0) return;

        minimizePomodoroTask(taskIdsToAdd[0]);
        placeTasksAfterGroup(targetGroup, taskIdsToAdd);
        applyUpdatedGroup({
            ...targetGroup,
            taskIds: [...targetGroup.taskIds, ...taskIdsToAdd],
        }, taskIdsToAdd);

        try {
            const updatedGroup = await taskGroupService.replaceTasks(
                targetGroup.groupId,
                [...targetGroup.taskIds, ...taskIdsToAdd],
            );
            applyUpdatedGroup(updatedGroup, taskIdsToAdd);
        } catch (err) {
            console.error('Error adding task to group:', err);
            await refreshGroups();
        }
    }, [applyUpdatedGroup, minimizePomodoroTask, placeTasksAfterGroup, refreshGroups]);

    const removeTasksFromGroup = useCallback(async (sourceGroup: TaskGroup, taskIds: string[]) => {
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
        if (moveDraggedOlderTasksToToday()) return;

        if (draggedGroupId) {
            reorderGroupRelativeToTask(draggedGroupId, targetTask.taskId, edge);
            finishDragging();
            return;
        }

        const draggedIds = draggedTaskIds.length > 0
            ? draggedTaskIds
            : draggedTaskId ? [draggedTaskId] : [];
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
        minimizePomodoroTask(draggedTaskId ?? movedTaskIds[0]);
        persistTaskOrder(orderWithoutMovedTasks);

        const sourceGroups = (groups ?? []).filter(group =>
            group.groupId !== targetGroup?.groupId && movedTaskIds.some(taskId => group.taskIds.includes(taskId)),
        );
        sourceGroups.forEach(sourceGroup => {
            void removeTasksFromGroup(sourceGroup, movedTaskIds);
        });
    }, [draggedGroupId, draggedTaskId, draggedTaskIds, finishDragging, groups, minimizePomodoroTask, moveDraggedOlderTasksToToday, persistTaskOrder, removeTasksFromGroup, reorderGroupRelativeToTask, visibleTasks]);

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
        const draggedIds = draggedTaskIds.length > 0
            ? draggedTaskIds
            : draggedTaskId ? [draggedTaskId] : [];
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
            void moveTasksToToday(draggedOlderTaskIds);
            finishDragging();
            return;
        }

        if (draggedGroupId) {
            const draggedGroup = groups?.find(group => group.groupId === draggedGroupId);
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
                minimizePomodoroTask(draggedTaskId ?? movedTaskIds[0]);
                const sourceGroups = (groups ?? []).filter(group =>
                    group.groupId !== targetGroup.groupId && movedTaskIds.some(taskId => group.taskIds.includes(taskId)),
                );
                sourceGroups.forEach(sourceGroup => {
                    void removeTasksFromGroup(sourceGroup, movedTaskIds);
                });
            }
        }
        finishDragging();
    }, [addTasksToGroup, draggedGroupId, draggedTaskId, draggedTaskIds, finishDragging, groups, minimizePomodoroTask, moveTasksToToday, olderTasks, removeTasksFromGroup, reorderRelativeToGroup, visibleTasks]);

    const handleDropAtBottom = useCallback(() => {
        if (moveDraggedOlderTasksToToday()) return;

        const orderedTaskIds = visibleTasks.map(task => task.taskId);

        if (draggedGroupId) {
            const group = groups?.find(candidate => candidate.groupId === draggedGroupId);
            if (group) {
                const visibleGroupTaskIds = orderedTaskIds.filter(taskId => group.taskIds.includes(taskId));
                const groupTaskIdSet = new Set(visibleGroupTaskIds);
                const orderWithoutGroup = orderedTaskIds.filter(taskId => !groupTaskIdSet.has(taskId));
                persistTaskOrder([...orderWithoutGroup, ...visibleGroupTaskIds]);
            }
            finishDragging();
            return;
        }

        const draggedIds = draggedTaskIds.length > 0
            ? draggedTaskIds
            : draggedTaskId ? [draggedTaskId] : [];
        if (draggedIds.length > 0) {
            const draggedIdSet = new Set(draggedIds);
            const movedTaskIds = orderedTaskIds.filter(taskId => draggedIdSet.has(taskId));
            if (movedTaskIds.length > 0) {
                const orderWithoutMovedTasks = orderedTaskIds.filter(taskId => !draggedIdSet.has(taskId));
                const nextOrder = [...orderWithoutMovedTasks, ...movedTaskIds];
                minimizePomodoroTask(draggedTaskId ?? movedTaskIds[0]);
                persistTaskOrder(nextOrder);
                const sourceGroups = (groups ?? []).filter(group =>
                    movedTaskIds.some(taskId => group.taskIds.includes(taskId)),
                );
                sourceGroups.forEach(sourceGroup => {
                    void removeTasksFromGroup(sourceGroup, movedTaskIds);
                });
            }
        }
        finishDragging();
    }, [draggedGroupId, draggedTaskId, draggedTaskIds, finishDragging, groups, minimizePomodoroTask, moveDraggedOlderTasksToToday, persistTaskOrder, removeTasksFromGroup, visibleTasks]);

    const handleDropAtTop = useCallback(() => {
        if (moveDraggedOlderTasksToToday()) return;

        const orderedTaskIds = visibleTasks.map(task => task.taskId);

        if (draggedGroupId) {
            const group = groups?.find(candidate => candidate.groupId === draggedGroupId);
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

        const draggedIds = draggedTaskIds.length > 0
            ? draggedTaskIds
            : draggedTaskId ? [draggedTaskId] : [];
        if (draggedIds.length > 0) {
            const draggedIdSet = new Set(draggedIds);
            const movedTaskIds = orderedTaskIds.filter(taskId => draggedIdSet.has(taskId));
            if (movedTaskIds.length > 0) {
                persistTaskOrder([
                    ...movedTaskIds,
                    ...orderedTaskIds.filter(taskId => !draggedIdSet.has(taskId)),
                ]);
                minimizePomodoroTask(draggedTaskId ?? movedTaskIds[0]);
                const sourceGroups = (groups ?? []).filter(group =>
                    movedTaskIds.some(taskId => group.taskIds.includes(taskId)),
                );
                sourceGroups.forEach(sourceGroup => {
                    void removeTasksFromGroup(sourceGroup, movedTaskIds);
                });
            }
        }
        finishDragging();
    }, [draggedGroupId, draggedTaskId, draggedTaskIds, finishDragging, groups, minimizePomodoroTask, moveDraggedOlderTasksToToday, persistTaskOrder, removeTasksFromGroup, visibleTasks]);

    function keepDragTargetInView(event: React.DragEvent<HTMLElement>) {
        if (draggedTaskIds.length === 0 && !draggedTaskId && !draggedGroupId) return;

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
        selectionAnchorRef.current = null;
    }

    async function createGroup() {
        const trimmedName = groupName.trim();
        if (!trimmedName || selectedTaskIds.length < 2) return;

        setGroupSubmitting(true);
        try {
            const createdGroup = await taskGroupService.createGroup(trimmedName, selectedTaskIds);
            const selectedTaskIdSet = new Set(selectedTaskIds);
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
            setGroupDialogOpen(false);
            setGroupName('');
            setCollapsedGroupIds(previous => new Set(previous).add(createdGroup.groupId));
        } catch (err) {
            console.error('Error creating task group:', err);
        } finally {
            setGroupSubmitting(false);
        }
    }

    async function createTaskInGroup(group: TaskGroup, firstVisibleTaskId?: string) {
        const taskName = groupTaskDraft.trim();
        if (!taskName || groupTaskSubmissionRef.current) return;

        groupTaskSubmissionRef.current = true;
        setGroupTaskSubmitting(true);
        try {
            const createdTask = await taskService.createTask({
                name: taskName,
                description: '',
                scheduledPerformDateTime: '',
                tag: '',
                importance: 0,
            });
            const nextTaskIds = [...group.taskIds, createdTask.taskId];
            const taskOrder = allTasks.map(task => task.taskId);
            const groupTaskIndex = taskOrder.indexOf(firstVisibleTaskId ?? group.taskIds[0]);
            taskOrder.splice(groupTaskIndex === -1 ? taskOrder.length : groupTaskIndex, 0, createdTask.taskId);

            addTaskToState(createdTask);
            reorderTasksInState(taskOrder);
            setGroups(previous => (previous ?? []).map(existingGroup =>
                existingGroup.groupId === group.groupId
                    ? { ...existingGroup, taskIds: nextTaskIds }
                    : existingGroup,
            ));
            setCollapsedGroupIds(previous => {
                const next = new Set(previous);
                next.delete(group.groupId);
                return next;
            });
            const updatedGroup = await taskGroupService.replaceTasks(group.groupId, nextTaskIds);
            setGroups(previous => (previous ?? []).map(existingGroup =>
                existingGroup.groupId === updatedGroup.groupId ? updatedGroup : existingGroup,
            ));
            setGroupAddingTaskId(null);
            setGroupTaskDraft('');
        } catch (err) {
            console.error('Error creating task in group:', err);
            await refreshGroups();
        } finally {
            groupTaskSubmissionRef.current = false;
            setGroupTaskSubmitting(false);
        }
    }

    function startTaskInGroup(groupId: string) {
        if (groupTaskSubmitting) return;
        setGroupAddingTaskId(groupId);
        setGroupTaskDraft('');
        setCollapsedGroupIds(previous => {
            const next = new Set(previous);
            next.delete(groupId);
            return next;
        });
    }

    async function deleteGroup(group: TaskGroup) {
        try {
            await taskGroupService.deleteGroup(group.groupId);
            setGroups(previous => (previous ?? []).filter(existingGroup => existingGroup.groupId !== group.groupId));
            setCollapsedGroupIds(previous => {
                const next = new Set(previous);
                next.delete(group.groupId);
                return next;
            });
        } catch (err) {
            console.error('Error deleting task group:', err);
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
        if (draggedTask.taskId === activePomodoroTaskIdRef.current) {
            clearFocusTransitionTimer();
            setActiveExpansion(null);
            setInitialPomodoroStatus(null);
            setFocusVisibility('all');
        }
        const visibleTaskIds = visibleTasks.map(task => task.taskId);
        const selectedVisibleTaskIds = visibleTaskIds.filter(taskId => selectedTaskIds.includes(taskId));
        const taskIdsToDrag = selectedVisibleTaskIds.includes(draggedTask.taskId)
            ? selectedVisibleTaskIds
            : [draggedTask.taskId];
        setDraggedTaskIds(taskIdsToDrag);
        setDraggedTaskId(draggedTask.taskId);
        setDraggedGroupId(null);
        setDragTargetTaskId(null);
        setDragTargetGroupId(null);
        setDragTargetPosition(null);
        setDragTargetTop(false);
        setDragTargetBottom(false);
    }, [clearFocusTransitionTimer, selectedTaskIds, visibleTasks]);

    const handleTaskDragOver = useCallback((dragTargetTask: Task, event: React.DragEvent<HTMLElement>) => {
        const currentDraggedTaskIds = draggedTaskIds.length > 0
            ? draggedTaskIds
            : draggedTaskId ? [draggedTaskId] : [];
        const containingGroup = groups?.find(group => group.taskIds.includes(dragTargetTask.taskId));
        if ((currentDraggedTaskIds.length > 0 && !currentDraggedTaskIds.includes(dragTargetTask.taskId)) || draggedGroupId) {
            const addingToExpandedGroup = Boolean(
                containingGroup
                && currentDraggedTaskIds.length > 0
                && !draggedGroupId
                && currentDraggedTaskIds.some(taskId => !containingGroup.taskIds.includes(taskId)),
            );
            if (addingToExpandedGroup) {
                setDragTargetTaskId(dragTargetTask.taskId);
                setDragTargetGroupId(containingGroup!.groupId);
                setDragTargetPosition('inside');
                setDragTargetTop(false);
                setDragTargetBottom(false);
                return;
            }

            const edge = taskDropEdge(event);
            setDragTargetTaskId(dragTargetTask.taskId);
            setDragTargetGroupId(null);
            setDragTargetPosition(edge);
            setDragTargetTop(false);
            setDragTargetBottom(false);
        }
    }, [draggedGroupId, draggedTaskId, draggedTaskIds, groups]);

    const handleTaskDrop = useCallback((droppedTask: Task, event: React.DragEvent<HTMLElement>) => {
        const currentDraggedTaskIds = draggedTaskIds.length > 0
            ? draggedTaskIds
            : draggedTaskId ? [draggedTaskId] : [];
        const containingGroup = groups?.find(group => group.taskIds.includes(droppedTask.taskId));
        const olderTaskIdSet = new Set(olderTasks.map(olderTask => olderTask.taskId));
        const draggedOlderTaskIds = currentDraggedTaskIds.filter(taskId => olderTaskIdSet.has(taskId));
        if (containingGroup && draggedOlderTaskIds.length > 0) {
            void moveTasksToToday(draggedOlderTaskIds);
            void addTasksToGroup(containingGroup, draggedOlderTaskIds);
            finishDragging();
            return;
        }
        if (moveDraggedOlderTasksToToday()) return;
        if (containingGroup && currentDraggedTaskIds.length > 0 && !draggedGroupId
            && currentDraggedTaskIds.some(taskId => !containingGroup.taskIds.includes(taskId))) {
            void addTasksToGroup(containingGroup, currentDraggedTaskIds);
            finishDragging();
            return;
        }
        handleDropOnTask(droppedTask, taskDropEdge(event));
    }, [addTasksToGroup, draggedGroupId, draggedTaskId, draggedTaskIds, finishDragging, groups,
        handleDropOnTask, moveDraggedOlderTasksToToday, moveTasksToToday, olderTasks]);

    function renderTaskRow(
        task: Task,
        options: { reorderable?: boolean; draggable?: boolean; showScheduledDate?: boolean } = {},
    ) {
        const reorderable = options.reorderable ?? true;
        return (
            <FlatTaskRow
                key={task.taskId}
                task={task}
                onToggle={toggleTaskCompletion}
                onUpdate={updateTask}
                expandedPanel={activeExpansion?.taskId === task.taskId ? activeExpansion.panel : null}
                onTogglePanel={handleTogglePanel}
                onAutoExpand={handleAutoExpand}
                onDelete={deleteTask}
                selected={selectedTaskIdSet.has(task.taskId)}
                onSelectionClick={handleTaskSelection}
                showScheduledDate={options.showScheduledDate}
                reorderable={reorderable}
                draggable={options.draggable ?? reorderable}
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
                onPomodoroFocusStart={handlePomodoroFocusStart}
                deferPomodoroHydration={task.taskId !== activePomodoroTaskId}
                initialPomodoroStatus={task.taskId === activePomodoroTaskId ? initialPomodoroStatus : null}
                expectedPomodoroActive={task.taskId === activePomodoroTaskId}
            />
        );
    }

    function renderTaskList(
        items: TaskListItem[],
        options: { reorderable?: boolean; draggable?: boolean; showScheduledDate?: boolean } = {},
    ) {
        const reorderable = options.reorderable ?? true;
        return items.map(item => {
            if (item.kind === 'task') return renderTaskRow(item.task, options);

            const collapsed = collapsedGroupIds.has(item.group.groupId);
            const groupDragging = draggedGroupId === item.group.groupId;
            const groupDragTarget = dragTargetGroupId === item.group.groupId;
            return (
                <Box
                    key={item.group.groupId}
                    sx={{
                        mb: 0.4,
                        animation: `${groupReveal} 170ms cubic-bezier(0.22, 1, 0.36, 1)`,
                    }}
                >
                    <Box
                        data-task-group-header="true"
                        draggable={reorderable}
                        onDragStart={reorderable ? (event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', `group:${item.group.groupId}`);
                            if (!collapsed) {
                                temporarilyCollapsedGroupIdRef.current = item.group.groupId;
                                setCollapsedGroupIds(previous => new Set(previous).add(item.group.groupId));
                            } else {
                                temporarilyCollapsedGroupIdRef.current = null;
                            }
                            setDraggedGroupId(item.group.groupId);
                            setDraggedTaskIds([]);
                            setDraggedTaskId(null);
                            setDragTargetGroupId(null);
                            setDragTargetTaskId(null);
                            setDragTargetPosition(null);
                            setDragTargetTop(false);
                            setDragTargetBottom(false);
                        } : undefined}
                        onDragOver={reorderable ? (event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            if (draggedGroupId !== item.group.groupId || draggedTaskIds.length > 0 || draggedTaskId) {
                                const intent = draggedGroupId ? taskDropEdge(event) : groupDropIntent(event);
                                setDragTargetGroupId(item.group.groupId);
                                setDragTargetTaskId(null);
                                setDragTargetPosition(intent);
                                setDragTargetTop(false);
                                setDragTargetBottom(false);
                            }
                        } : undefined}
                        onDrop={reorderable ? (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const intent = draggedGroupId ? taskDropEdge(event) : groupDropIntent(event);
                            handleDropOnGroup(item.group, intent);
                        } : undefined}
                        onDragEnd={reorderable ? finishDragging : undefined}
                        sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 42,
                            borderRadius: 1.5,
                            px: 0.35,
                            color: 'text.secondary',
                            opacity: groupDragging ? 0.42 : 1,
                            transform: groupDragging ? 'scale(0.98)' : 'scale(1)',
                            backgroundColor: groupDragTarget && dragTargetPosition === 'inside' ? 'action.hover' : 'transparent',
                            transition: 'opacity 0.16s, transform 0.16s, background-color 0.18s',
                            '&:hover': { backgroundColor: 'action.hover' },
                            '&::before': groupDragTarget && dragTargetPosition !== 'inside' ? {
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
                            onClick={() => toggleGroup(item.group.groupId)}
                        >
                            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                        <Typography
                            variant="body2"
                            onClick={() => toggleGroup(item.group.groupId)}
                            sx={{ flex: 1, textAlign: 'left', fontWeight: 650, cursor: 'pointer' }}
                        >
                            {item.group.name}
                            <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                                {item.tasks.length}
                            </Typography>
                            </Typography>
                        <IconButton
                            size="small"
                            color="inherit"
                            aria-label={`Add task to ${item.group.name}`}
                            title="Add task to group"
                            onClick={event => {
                                event.stopPropagation();
                                startTaskInGroup(item.group.groupId);
                            }}
                            disabled={groupTaskSubmitting || groupAddingTaskId === item.group.groupId}
                        >
                            {groupTaskSubmitting && groupAddingTaskId === item.group.groupId
                                ? <CircularProgress size={18} />
                                : <AddIcon fontSize="small" />}
                        </IconButton>
                        <IconButton
                            size="small"
                            color="inherit"
                            aria-label={`Ungroup ${item.group.name}`}
                            title="Ungroup"
                            onClick={() => deleteGroup(item.group)}
                        >
                            <LinkOffIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Collapse
                        in={!collapsed}
                        timeout={210}
                        unmountOnExit
                        sx={{
                            willChange: 'height',
                            '& .MuiCollapse-wrapper': { willChange: 'height' },
                        }}
                    >
                        <Box sx={{ ml: 1.7, pl: 1.1, borderLeft: '1px solid', borderColor: 'divider' }}>
                            {groupAddingTaskId === item.group.groupId && (
                                <Box sx={{ px: 1.75, py: 0.5 }}>
                                    <TextField
                                        autoFocus
                                        fullWidth
                                        multiline
                                        variant="standard"
                                        value={groupTaskDraft}
                                        placeholder="Add task..."
                                        disabled={groupTaskSubmitting}
                                        onChange={event => setGroupTaskDraft(event.target.value)}
                                        onBlur={() => {
                                            if (groupTaskDraft.trim()) {
                                                void createTaskInGroup(item.group, item.tasks[0]?.taskId);
                                            }
                                        }}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                void createTaskInGroup(item.group, item.tasks[0]?.taskId);
                                            } else if (event.key === 'Escape') {
                                                setGroupAddingTaskId(null);
                                                setGroupTaskDraft('');
                                            }
                                        }}
                                        inputProps={{
                                            draggable: false,
                                            'aria-label': `New task in ${item.group.name}`,
                                        }}
                                        sx={{
                                            '& input::placeholder, & textarea::placeholder': {
                                                color: 'text.disabled',
                                                opacity: 1,
                                            },
                                        }}
                                    />
                                </Box>
                            )}
                            {item.tasks.map(task => renderTaskRow(task, options))}
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
        || focusVisibility === 'fading'
        || focusVisibility === 'revealing';

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
                            opacity: 0,
                            animation: `${greetingReveal} 560ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards`,
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
                        <SmartTaskInput onSubmit={createTask} />
                    </Box>

                    {selectedTaskIds.length > 1 && selectionActionsPosition && (
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
                                aria-label="Group selected tasks"
                                title="Group selected tasks"
                                onClick={() => setGroupDialogOpen(true)}
                                disabled={bulkActionLoading}
                            >
                                <GroupWorkIcon fontSize="small" />
                            </IconButton>
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
                    )}

                    <Box ref={taskListTopRef} sx={{ height: 0 }} />

                    {pomodoroStatusResolved && groups !== null && visibleTasks.length > 0 ? (
                        <>
                            {focusedPomodoroTask && focusVisibility !== 'fading' && (
                                <Box
                                    sx={{
                                        '--focus-task-offset': `${focusTaskOffset}px`,
                                        animation: focusVisibility === 'sliding' && focusTaskOffset !== 0
                                            ? `${focusTaskSlide} ${FOCUS_TASK_SLIDE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                                            : 'none',
                                    }}
                                >
                                    {renderTaskRow(focusedPomodoroTask)}
                                </Box>
                            )}

                            {focusedPomodoroTask && focusVisibility === 'hidden' && tasksBelowFocus.length > 0 && (
                                <Button
                                    size="small"
                                    startIcon={<VisibilityIcon />}
                                    onClick={showAllTasks}
                                    sx={{
                                        mt: 1,
                                        mb: 0.75,
                                        animation: `${buttonFadeIn} 220ms ease-out`,
                                    }}
                                >
                                    Show all tasks
                                </Button>
                            )}

                            {showTasksBelowFocus && (
                                <Box
                                    sx={{
                                        animation: focusVisibility === 'revealing'
                                            ? `${tasksFadeBack} 260ms ease-out`
                                            : 'none',
                                        '& [data-task-id]:not([data-pomodoro-focus-task="true"]), & [data-task-group-header="true"]': {
                                            animation: focusVisibility === 'fading'
                                                ? `${tasksFadeAway} ${TASKS_FADE_DURATION_MS}ms ease-out forwards`
                                                : 'none',
                                        },
                                        pointerEvents: focusVisibility === 'fading' ? 'none' : 'auto',
                                    }}
                                >
                                    <Box
                                        aria-hidden="true"
                                        onDragOver={(event) => {
                                            if (draggedTaskIds.length === 0 && !draggedTaskId && !draggedGroupId) return;
                                            event.preventDefault();
                                            event.dataTransfer.dropEffect = 'move';
                                            setDragTargetTop(true);
                                            setDragTargetBottom(false);
                                            setDragTargetTaskId(null);
                                            setDragTargetGroupId(null);
                                            setDragTargetPosition(null);
                                        }}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            handleDropAtTop();
                                        }}
                                        sx={{
                                            position: 'relative',
                                            height: 24,
                                            '&::before': dragTargetTop ? {
                                                content: '""',
                                                position: 'absolute',
                                                bottom: 6,
                                                left: 10,
                                                right: 10,
                                                height: 2,
                                                borderRadius: 2,
                                                backgroundColor: 'primary.main',
                                            } : undefined,
                                        }}
                                    />
                                    {renderTaskList(taskListItems)}
                                    {(
                                        <Box
                                            aria-hidden="true"
                                            onDragOver={(event) => {
                                                if (draggedTaskIds.length === 0 && !draggedTaskId && !draggedGroupId) return;
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = 'move';
                                                setDragTargetBottom(true);
                                                setDragTargetTop(false);
                                                setDragTargetTaskId(null);
                                                setDragTargetGroupId(null);
                                                setDragTargetPosition(null);
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                handleDropAtBottom();
                                            }}
                                            sx={{
                                                position: 'relative',
                                                height: 32,
                                                '&::before': dragTargetBottom ? {
                                                    content: '""',
                                                    position: 'absolute',
                                                    top: 8,
                                                    left: 10,
                                                    right: 10,
                                                    height: 2,
                                                    borderRadius: 2,
                                                    backgroundColor: 'primary.main',
                                                } : undefined,
                                            }}
                                        />
                                    )}
                                </Box>
                            )}
                        </>
                    ) : pomodoroStatusResolved && groups !== null ? (
                        <Typography
                            variant="body1"
                            color="text.secondary"
                            onDragOver={(event) => {
                                if (draggedTaskIds.length === 0 && !draggedTaskId && !draggedGroupId) return;
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                                setDragTargetTop(true);
                                setDragTargetBottom(false);
                                setDragTargetTaskId(null);
                                setDragTargetGroupId(null);
                                setDragTargetPosition(null);
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
                                '&::before': dragTargetTop ? {
                                    content: '""',
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 10,
                                    right: 10,
                                    height: 2,
                                    borderRadius: 2,
                                    backgroundColor: 'primary.main',
                                } : undefined,
                            }}
                        >
                            Nothing scheduled for today.
                        </Typography>
                    ) : null}

                    <Collapse
                        in={pomodoroStatusResolved && groups !== null && focusVisibility === 'all'
                            && showOlderTasks && olderTasks.length > 0}
                        timeout={{ enter: 260, exit: 220 }}
                        mountOnEnter
                        unmountOnExit
                    >
                        <Box
                            onClick={event => event.stopPropagation()}
                            sx={{ mt: 2, pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }}
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
                                />
                            </Box>
                        </Box>
                    </Collapse>

                    <Collapse
                        in={olderTasks.length > 0 && focusVisibility === 'all'}
                        timeout={{ enter: 220, exit: 180 }}
                        mountOnEnter
                        unmountOnExit
                    >
                        <Button
                            variant="text"
                            size="small"
                            color={overdueCount > 0 ? 'warning' : 'inherit'}
                            startIcon={<HistoryIcon />}
                            onClick={event => {
                                event.stopPropagation();
                                toggleOlderTasks();
                            }}
                            sx={{ mt: 2, alignSelf: 'flex-start' }}
                        >
                            {showOlderTasks ? 'Hide older tasks' : `View older tasks (${olderTasks.length})`}
                        </Button>
                    </Collapse>
                </Box>

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
                                width: 270,
                                maxWidth: 'calc(100vw - 32px)',
                                borderRadius: 2.5,
                            },
                        },
                    }}
                >
                    {deleteRequest && (
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1.25 }}>
                                {deleteRequest.kind === 'bulk'
                                    ? `Delete ${deleteRequest.tasks.length} selected task${deleteRequest.tasks.length > 1 ? 's' : ''} and their subtasks?`
                                    : `Delete “${deleteRequest.tasks[0].name}” and its subtasks?`}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                                <Button size="small" onClick={closeDeleteRequest} disabled={deleteSubmitting}>Cancel</Button>
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
                        </Box>
                    )}
                </Popover>

                <Dialog
                    open={groupDialogOpen}
                    onClose={() => !groupSubmitting && setGroupDialogOpen(false)}
                    onClick={event => event.stopPropagation()}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>Group selected tasks</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Group name"
                            placeholder="Morning routine"
                            value={groupName}
                            onChange={event => setGroupName(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    createGroup();
                                }
                            }}
                            disabled={groupSubmitting}
                            sx={{ mt: 1 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setGroupDialogOpen(false)} disabled={groupSubmitting}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={createGroup}
                            disabled={groupSubmitting || !groupName.trim()}
                            startIcon={groupSubmitting ? <CircularProgress size={14} /> : <GroupWorkIcon />}
                        >
                            Create group
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar
                    key={taskFeedback?.id}
                    open={taskFeedback !== null}
                    autoHideDuration={2000}
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
                            onClose={() => setTaskFeedback(null)}
                            sx={{
                                position: 'relative',
                                minWidth: 190,
                                maxWidth: 'calc(100vw - 48px)',
                                boxSizing: 'border-box',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'background.paper',
                                px: 1.5,
                                pr: 5,
                                py: 0.5,
                                '& .MuiAlert-message': {
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    py: 0.25,
                                    textAlign: 'center',
                                    fontSize: '0.85rem',
                                },
                                '& .MuiAlert-action': {
                                    position: 'absolute',
                                    top: '50%',
                                    right: 6,
                                    p: 0,
                                    m: 0,
                                    transform: 'translateY(-50%)',
                                },
                            }}
                        >
                            {taskFeedback.message}
                        </Alert>
                    ) : undefined}
                </Snackbar>

                <DayWidget />
            </Box>
        </PageWrapper>
    );
}

export default HomePage;
