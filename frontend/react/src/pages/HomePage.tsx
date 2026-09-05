import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Collapse,
    Alert,
    Fade,
    IconButton,
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
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { taskGroupService, taskService } from '../services/api';
import { Task } from '../types/Task';
import { TaskGroup } from '../types/TaskGroup';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../hooks/useGlobalTasks';
import { useUser } from '../hooks/useUser';
import { SmartTaskInput } from '../components/input/SmartTaskInput';
import { FlatTaskRow } from '../components/FlatTaskRow';
import { TaskToCreate } from '../types/TaskToCreate';
import { getShowCompletedHomeTasks } from '../services/utils/homePreferences';
import { PomodoroStatus } from '../types/PomodoroStatus';
import { celebrateStatLogged } from '../services/statCelebration';
import { playAudioFeedback } from '../services/audioFeedback';
import { BulkTaskDatePopover } from '../components/task/BulkTaskDatePopover';

type ActiveExpansion = { taskId: string; panel: 'pomodoro' | 'details' } | null;
type FocusVisibility = 'all' | 'fading' | 'sliding' | 'hidden' | 'revealing';
type DropEdge = 'before' | 'after';
type GroupDropIntent = DropEdge | 'inside';
type BulkAction = 'complete' | 'reopen' | 'move-to-today' | 'move-to-date' | 'clear-date';
type DeleteRequest =
    | { kind: 'single' | 'bulk'; tasks: Task[]; anchorEl: HTMLElement }
    | { kind: 'group'; group: TaskGroup; tasks: Task[]; anchorEl: HTMLElement };
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
type TaskListItem =
    | { kind: 'task'; task: Task }
    | { kind: 'group'; group: TaskGroup; tasks: Task[] };
type SelectionEntity =
    | { kind: 'task'; id: string }
    | { kind: 'group'; id: string };
type ActiveDrag =
    | { kind: 'tasks'; taskIds: string[]; primaryTaskId: string; preservedGroupIds: string[] }
    | { kind: 'group'; groupId: string };
type TodayDropPlacement =
    | { kind: 'task'; targetTaskId: string; edge: DropEdge }
    | { kind: 'group'; targetGroup: TaskGroup; edge: DropEdge }
    | { kind: 'edge'; edge: 'top' | 'bottom' };

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
const SELECTION_ACTIONS_GAP = 4;
const SELECTION_ACTIONS_FALLBACK_WIDTH = 136;

const SlideFromRight = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof Slide>>(
    (props, ref) => <Slide {...props} ref={ref} direction="left" />,
);
SlideFromRight.displayName = 'SlideFromRight';

let hasAnimatedHomeGreeting = false;

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

function dropIntent(event: React.DragEvent<HTMLElement>): GroupDropIntent {
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

type GroupTaskInputRowProps = {
    groupName: string;
    disabled: boolean;
    onSubmit: (task: TaskToCreate) => void;
    onEscape: () => void;
    onBlur: () => void;
};

const GroupTaskInputRow = React.forwardRef<HTMLDivElement, GroupTaskInputRowProps>(function GroupTaskInputRow({
    groupName,
    disabled,
    onSubmit,
    onEscape,
    onBlur,
}, ref) {
    const [importance, setImportance] = useState(0);
    const checkboxColor = importance > 7
        ? '#ef4444'
        : importance > 4
            ? '#eab308'
            : importance > 0
                ? '#1976d2'
                : 'text.disabled';

    return (
        <Box
            ref={ref}
            onClick={event => event.stopPropagation()}
            sx={{
                position: 'relative',
                borderRadius: 1.5,
                border: '1.5px solid transparent',
                backgroundColor: 'transparent',
                overflow: 'hidden',
                mb: 0.25,
                transition: 'background-color 0.2s',
                '&:hover': { backgroundColor: 'action.hover' },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, px: 0.5 }}>
                <Checkbox
                    size="small"
                    checked={false}
                    disabled
                    sx={{
                        color: checkboxColor,
                        '&.Mui-disabled': { color: checkboxColor },
                        mr: 0.5,
                    }}
                />
                <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    <SmartTaskInput
                        autoFocus
                        disabled={disabled}
                        placeholder="Add to group"
                        submitOnBlur
                        onSubmit={onSubmit}
                        onEscape={onEscape}
                        onBlur={onBlur}
                        onImportanceChange={setImportance}
                        showMetadataChips={false}
                        multiline
                        minRows={1}
                        maxRows={4}
                        inputProps={{
                            draggable: false,
                            'aria-label': `New task in ${groupName}`,
                        }}
                        textFieldSx={{
                            '& .MuiInput-underline:before, & .MuiInput-underline:after, & .MuiInput-underline:hover:not(.Mui-disabled):before': {
                                borderBottom: 'none',
                            },
                            '& .MuiInputBase-root': {
                                height: '100%',
                                padding: 0,
                            },
                            '& .MuiInputBase-input': {
                                color: 'text.primary',
                                fontSize: '1.05rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                maxHeight: '100%',
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                                hyphens: 'auto',
                                textAlign: 'left',
                                padding: 0,
                            },
                            '& input::placeholder, & textarea::placeholder': {
                                color: 'text.disabled',
                                opacity: 1,
                            },
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
});
GroupTaskInputRow.displayName = 'GroupTaskInputRow';

function sameTaskGroup(first: TaskGroup, second: TaskGroup): boolean {
    return first.groupId === second.groupId
        && first.name === second.name
        && first.displayOrder === second.displayOrder
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

export function HomePage() {
    const { user } = useUser();
    const [animateGreeting] = useState(() => !hasAnimatedHomeGreeting);
    const [activeExpansion, setActiveExpansion] = useState<ActiveExpansion>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [selectionActionsPosition, setSelectionActionsPosition] = useState<{ top: number; left: number } | null>(null);
    const [taskFeedback, setTaskFeedback] = useState<TaskFeedback | null>(null);
    const [showOlderTasks, setShowOlderTasks] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [groupAnchorEl, setGroupAnchorEl] = useState<HTMLElement | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupSubmitting, setGroupSubmitting] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [localGroupName, setLocalGroupName] = useState('');
    const [groupAddingTaskId, setGroupAddingTaskId] = useState<string | null>(null);
    const [groupTaskSubmitting, setGroupTaskSubmitting] = useState(false);
    const [bulkDateAnchorEl, setBulkDateAnchorEl] = useState<HTMLElement | null>(null);
    const [bulkDateDraft, setBulkDateDraft] = useState(() => new Date());
    const cachedGroups = taskGroupService.getCachedGroups();
    const [groups, setGroups] = useState<TaskGroup[] | null>(() => cachedGroups ?? null);
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
        () => new Set((cachedGroups ?? []).map(group => group.groupId)),
    );
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const groupNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
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
    const pendingUndoRef = useRef<PendingUndo | null>(null);
    const focusTransitionTimerRef = useRef<number | null>(null);
    const temporarilyCollapsedGroupIdRef = useRef<string | null>(null);
    const groupTaskSubmissionRef = useRef(false);
    const activeDragRef = useRef<ActiveDrag | null>(null);

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
    const selectedGroupIdSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
    const selectedGroupTaskIdSet = useMemo(
        () => new Set((groups ?? [])
            .filter(group => selectedGroupIdSet.has(group.groupId))
            .flatMap(group => group.taskIds)),
        [groups, selectedGroupIdSet],
    );
    const selectedActionTaskIdSet = useMemo(
        () => new Set([...selectedTaskIds, ...selectedGroupTaskIdSet]),
        [selectedGroupTaskIdSet, selectedTaskIds],
    );
    const selectedTasks = useMemo(
        () => allTasks.filter(task => selectedActionTaskIdSet.has(task.taskId)),
        [allTasks, selectedActionTaskIdSet],
    );
    const olderTaskIdSet = useMemo(() => new Set(olderTasks.map(task => task.taskId)), [olderTasks]);
    const selectedOlderTasks = useMemo(
        () => selectedTasks.filter(task => olderTaskIdSet.has(task.taskId)),
        [olderTaskIdSet, selectedTasks],
    );
    const selectionEntityCount = selectedTaskIds.length + selectedGroupIds.length;
    const selectionActionsVisible = selectionEntityCount > 1 || selectedGroupIds.length > 0;
    const canGroupSelectedTasks = selectedGroupIds.length === 0 && selectedTaskIds.length >= 2;
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
                if (!collapsedGroupIds.has(item.group.groupId)) {
                    item.tasks.forEach(task => entities.push({ kind: 'task', id: task.taskId }));
                }
            });
        };

        appendItems(taskListItems);
        if (showOlderTasks) appendItems(olderTaskListItems);
        return entities;
    }, [focusedPomodoroTask, collapsedGroupIds, olderTaskListItems, showOlderTasks, taskListItems]);

    const homeContentReady = tasksLoaded && pomodoroStatusResolved && groups !== null;

    const updateSelectionActionsPosition = useCallback(() => {
        if (!selectionActionsVisible) {
            setSelectionActionsPosition(null);
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

    useEffect(() => () => {
        const pendingUndo = pendingUndoRef.current;
        if (!pendingUndo) return;
        window.clearTimeout(pendingUndo.timeoutId);
        pendingUndoRef.current = null;
        void pendingUndo.commit();
    }, []);

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
                playAudioFeedback('taskCompleted');
                showUndoFeedback('Task completed', async () => {
                    try {
                        const restoredTask = await taskService.updateTask(taskId, { completed: wasCompleted });
                        updateTaskInState(taskId, restoredTask);
                    } catch (error) {
                        console.error('Error undoing task completion:', error);
                        await refreshTaskBuckets(true);
                    }
                });
            }
        } catch (err) {
            console.error('Error toggling task:', err);
            if (task) updateTaskInState(taskId, { completed: task.completed });
        }
    }, [allTasks, refreshTaskBuckets, showUndoFeedback, updateTaskInState]);

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
        if (deleteSubmitting) return;

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

    function confirmDelete() {
        if (!deleteRequest || deleteSubmitting) return;

        const request = deleteRequest;
        const previousGroups = groups ?? [];
        const previousCollapsedGroupIds = new Set(collapsedGroupIds);
        const previousTaskOrder = allTasks.map(task => task.taskId);
        setDeleteRequest(null);
        setDeleteSubmitting(false);

        if (request.kind === 'group') {
            request.tasks.forEach(task => removeTaskFromState(task.taskId));
            setGroups(previous => (previous ?? []).filter(group => group.groupId !== request.group.groupId));
            setCollapsedGroupIds(previous => {
                const next = new Set(previous);
                next.delete(request.group.groupId);
                return next;
            });
        } else {
            request.tasks.forEach(task => removeTaskFromState(task.taskId));
            removeTasksFromGroups(request.tasks.map(task => task.taskId));
        }
        clearSelection();

        const restoreDeletedTasks = () => {
            request.tasks.forEach(task => addTaskToState(task));
            reorderTasksInState([...previousTaskOrder, ...request.tasks.map(task => task.taskId)]);
            setGroups(previousGroups);
            setCollapsedGroupIds(previousCollapsedGroupIds);
        };
        const commitDelete = async () => {
            try {
                if (request.kind === 'group') {
                    await taskGroupService.deleteGroup(request.group.groupId);
                }
                await Promise.all(request.tasks.map(task => taskService.deleteTask(task.taskId)));
            } catch (err) {
                console.error(`Error deleting ${request.kind === 'group' ? 'group' : request.kind === 'bulk' ? 'selected tasks' : 'task'}:`, err);
                await Promise.all([refreshTaskBuckets(true), refreshGroups()]);
            }
        };

        showUndoFeedback(
            request.kind === 'group'
                ? 'Group deleted'
                : request.kind === 'bulk'
                    ? `${request.tasks.length} tasks deleted`
                    : 'Task deleted',
            restoreDeletedTasks,
            commitDelete,
            'error',
        );
    }

    async function performBulkAction(action: BulkAction, scheduledDateTime?: string) {
        const tasksToUpdate = action === 'move-to-today' ? selectedOlderTasks : selectedTasks;
        if (action === 'move-to-date' && !scheduledDateTime) return;
        if (bulkActionLoading || tasksToUpdate.length === 0) return;
        const tasksToCelebrate = action === 'complete'
            ? tasksToUpdate.filter(task => !task.completed)
            : [];
        const completionOrigins = tasksToCelebrate
            .flatMap(task => Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
                .filter(row => row.dataset.taskId === task.taskId)
                .map(row => row.getBoundingClientRect()));
        const previousCompletion = new Map(tasksToUpdate.map(task => [task.taskId, task.completed]));

        setBulkActionLoading(true);
        try {
            const updatedTasks = await Promise.all(tasksToUpdate.map(task => {
                if (action === 'move-to-today') {
                    return taskService.updateTask(task.taskId, {
                        scheduledPerformDateTime: moveTaskDateToToday(task),
                    });
                }

                if (action === 'move-to-date') {
                    return taskService.updateTask(task.taskId, {
                        scheduledPerformDateTime: scheduledDateTime,
                    });
                }

                if (action === 'clear-date') {
                    return taskService.updateTask(task.taskId, {
                        scheduledPerformDateTime: '',
                    });
                }

                return taskService.updateTask(task.taskId, {
                    completed: action === 'complete',
                });
            }));
            updatedTasks.forEach(updatedTask => updateTaskInState(updatedTask.taskId, updatedTask));
            if (action === 'move-to-date' && scheduledDateTime && isSameLocalDay(new Date(scheduledDateTime), new Date())) {
                appendTasksToTodayOrder(
                    tasksToUpdate.filter(task => !isScheduledForToday(task)).map(task => task.taskId),
                );
            }
            if (action === 'complete' && tasksToCelebrate.length > 0) {
                completionOrigins.forEach(origin => celebrateStatLogged(origin));
                playAudioFeedback('taskCompleted');
                showUndoFeedback(
                    `${tasksToCelebrate.length} task${tasksToCelebrate.length === 1 ? '' : 's'} completed`,
                    async () => {
                        try {
                            const restoredTasks = await Promise.all(tasksToUpdate.map(task =>
                                taskService.updateTask(task.taskId, {
                                    completed: previousCompletion.get(task.taskId) ?? task.completed,
                                }),
                            ));
                            restoredTasks.forEach(restoredTask => updateTaskInState(restoredTask.taskId, restoredTask));
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
        if (activeExpansion?.taskId && activeExpansion.taskId !== taskId) {
            setActiveExpansion(null);
        }
        const anchorId = selectionAnchorRef.current;

        if (event.shiftKey && anchorId) {
            const anchorIndex = renderedSelectionEntities.findIndex(
                entity => entity.kind === 'task' && entity.id === anchorId,
            );
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
                setSelectedTaskIds(previous => [...new Set([...previous, ...rangeTaskIds])]);
                setSelectedGroupIds(previous => [...new Set([...previous, ...rangeGroupIds])]);
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
        setSelectedGroupIds([]);
        selectionAnchorRef.current = taskId;
    }, [activeExpansion, renderedSelectionEntities]);

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
                setSelectedTaskIds(previous => [...new Set([
                    ...previous,
                    ...rangeEntities.filter(entity => entity.kind === 'task').map(entity => entity.id),
                ])]);
                setSelectedGroupIds(previous => [...new Set([
                    ...previous,
                    ...rangeEntities.filter(entity => entity.kind === 'group').map(entity => entity.id),
                ])]);
                return;
            }
        }

        if (event.ctrlKey || event.metaKey) {
            setSelectedGroupIds(previous => previous.includes(groupId)
                ? previous.filter(selectedGroupId => selectedGroupId !== groupId)
                : [...previous, groupId]);
        } else {
            setSelectedGroupIds(previous => previous.includes(groupId)
                ? previous.filter(selectedGroupId => selectedGroupId !== groupId)
                : [...previous, groupId]);
        }
        selectionAnchorRef.current = groupId;
    }, [renderedSelectionEntities]);

    useEffect(() => {
        const handleTaskTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;
            const target = event.target;
            const editingTaskName = target instanceof Element
                && target.closest('[data-task-name-input="true"]');
            if (target instanceof Element
                && target.closest('input, textarea, select, [contenteditable="true"]')
                && !editingTaskName) {
                return;
            }

            const taskIds = renderedSelectionEntities
                .filter((entity): entity is Extract<SelectionEntity, { kind: 'task' }> => entity.kind === 'task')
                .map(entity => entity.id);
            if (taskIds.length === 0) return;

            const currentTaskId = selectionAnchorRef.current && taskIds.includes(selectionAnchorRef.current)
                ? selectionAnchorRef.current
                : selectedTaskIds[selectedTaskIds.length - 1];
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

        window.addEventListener('keydown', handleTaskTab);
        return () => window.removeEventListener('keydown', handleTaskTab);
    }, [renderedSelectionEntities, selectedTaskIds]);

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

    const appendTasksToTodayOrder = useCallback((taskIds: string[]) => {
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
        persistTaskOrder(orderWithoutMovedTasks);
    }, [allTasks, persistTaskOrder, todayTasks]);

    const placeTasksInTodayOrder = useCallback((taskIds: string[], placement: TodayDropPlacement) => {
        const movedTaskIdSet = new Set(taskIds);
        const movedTaskIds = allTasks
            .map(task => task.taskId)
            .filter(taskId => movedTaskIdSet.has(taskId));
        if (movedTaskIds.length === 0) return;

        const orderWithoutMovedTasks = allTasks
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
        persistTaskOrder(orderWithoutMovedTasks);
    }, [allTasks, persistTaskOrder, todayTasks, visibleTasks]);

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
        updates.forEach(({ task, scheduledPerformDateTime }) => {
            updateTaskInState(task.taskId, { scheduledPerformDateTime });
        });
        if (placement) placeTasksInTodayOrder(tasksToMove.map(task => task.taskId), placement);

        try {
            const updatedTasks = await Promise.all(updates.map(({ task, scheduledPerformDateTime }) =>
                taskService.updateTask(task.taskId, { scheduledPerformDateTime }),
            ));
            updatedTasks.forEach(updatedTask => updateTaskInState(updatedTask.taskId, updatedTask));
            return true;
        } catch (err) {
            console.error('Error moving dragged tasks to today:', err);
            await refreshTaskBuckets(true);
            return false;
        }
    }, [allTasks, olderTasks, placeTasksInTodayOrder, refreshTaskBuckets, updateTaskInState]);

    const moveGroupToToday = useCallback(async (group: TaskGroup, placement?: TodayDropPlacement) => {
        const groupTaskIdSet = new Set(group.taskIds);
        const tasksToMove = allTasks.filter(task => groupTaskIdSet.has(task.taskId));
        if (tasksToMove.length === 0) return;

        const updates = tasksToMove.map(task => ({
            task,
            scheduledPerformDateTime: moveTaskDateToToday(task),
        }));
        updates.forEach(({ task, scheduledPerformDateTime }) => {
            updateTaskInState(task.taskId, { scheduledPerformDateTime });
        });
        if (placement) placeTasksInTodayOrder(tasksToMove.map(task => task.taskId), placement);

        try {
            const updatedTasks = await taskGroupService.moveToToday(group.groupId);
            updatedTasks.forEach(updatedTask => updateTaskInState(updatedTask.taskId, updatedTask));
        } catch (err) {
            console.error('Error moving task group to today:', err);
            await refreshTaskBuckets(true);
        }
    }, [allTasks, placeTasksInTodayOrder, refreshTaskBuckets, updateTaskInState]);

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
        setGroups(previous => (previous ?? [])
            .map(group => group.groupId === updatedGroup.groupId
                ? updatedGroup
                : { ...group, taskIds: group.taskIds.filter(taskId => !movedTaskIdSet.has(taskId)) })
            .filter(group => group.taskIds.length >= 2));
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
        if (moveDraggedGroupToToday(
            intent === 'inside'
                ? undefined
                : { kind: 'group', targetGroup, edge: intent },
        )) return;
        const draggedIds = getDraggedTaskIds();
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
    }, [addTasksToGroup, finishDragging, getDraggedGroupId, getDraggedPreservedGroupIds, getDraggedTaskIds, getPrimaryDraggedTaskId, groups, minimizePomodoroTask,
        moveDraggedGroupToToday, moveTasksToToday, olderTasks, removeTasksFromGroup, reorderRelativeToGroup, visibleTasks]);

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
        setActiveExpansion(null);
        setBulkDateAnchorEl(null);
        setGroupAnchorEl(null);
        setGroupName('');
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

    async function createTaskInGroup(
        group: TaskGroup,
        firstVisibleTaskId?: string,
        taskToCreate?: TaskToCreate,
    ) {
        if (!taskToCreate?.name.trim() || groupTaskSubmissionRef.current) return;

        groupTaskSubmissionRef.current = true;
        setGroupTaskSubmitting(true);
        try {
            const createdTask = await taskService.createTask(taskToCreate);
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
                if (!previous.has(group.groupId)) return previous;

                const next = new Set(previous);
                next.delete(group.groupId);
                return next;
            });
            const updatedGroup = await taskGroupService.replaceTasks(group.groupId, nextTaskIds);
            setGroups(previous => replaceTaskGroupIfChanged(previous, updatedGroup));
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
        setDragTargetTop(false);
        setDragTargetBottom(false);
    }, [clearFocusTransitionTimer, olderTaskIdSet, olderTasks, selectedActionTaskIdSet, selectedGroupIds, visibleTasks]);

    const handleTaskDragOver = useCallback((dragTargetTask: Task, event: React.DragEvent<HTMLElement>) => {
        const currentDraggedTaskIds = getDraggedTaskIds();
        const activeGroupId = getDraggedGroupId();
        const containingGroup = groups?.find(group => group.taskIds.includes(dragTargetTask.taskId));
        if ((currentDraggedTaskIds.length > 0 && !currentDraggedTaskIds.includes(dragTargetTask.taskId)) || activeGroupId) {
            const addingToExpandedGroup = Boolean(
                containingGroup
                && currentDraggedTaskIds.length > 0
                && !activeGroupId
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

            const edge = containingGroup ? taskDropEdge(event) : dropIntent(event);
            setDragTargetTaskId(dragTargetTask.taskId);
            setDragTargetGroupId(null);
            setDragTargetPosition(edge);
            setDragTargetTop(false);
            setDragTargetBottom(false);
        }
    }, [getDraggedGroupId, getDraggedTaskIds, groups]);

    const handleTaskDrop = useCallback((droppedTask: Task, event: React.DragEvent<HTMLElement>) => {
        const currentDraggedTaskIds = getDraggedTaskIds();
        const activeGroupId = getDraggedGroupId();
        const containingGroup = groups?.find(group => group.taskIds.includes(droppedTask.taskId));
        const olderTaskIdSet = new Set(olderTasks.map(olderTask => olderTask.taskId));
        const draggedOlderTaskIds = currentDraggedTaskIds.filter(taskId => olderTaskIdSet.has(taskId));
        const intent = activeGroupId ? taskDropEdge(event) : dropIntent(event);
        const canAddToContainingGroup = Boolean(
            containingGroup
            && !activeGroupId
            && currentDraggedTaskIds.length > 0
            && currentDraggedTaskIds.some(taskId => !containingGroup.taskIds.includes(taskId)),
        );
        if (canAddToContainingGroup) {
            void (async () => {
                if (draggedOlderTaskIds.length > 0 && !(await moveTasksToToday(draggedOlderTaskIds))) return;
                await addTasksToGroup(containingGroup!, currentDraggedTaskIds);
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
                selected={selectedTaskIdSet.has(task.taskId) || selectedGroupTaskIdSet.has(task.taskId)}
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
            const groupDraggable = options.draggable ?? reorderable;
            return (
                <Box
                    key={item.group.groupId}
                    sx={{
                        mb: 0.4,
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
                                toggleGroup(item.group.groupId);
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
                                temporarilyCollapsedGroupIdRef.current = item.group.groupId;
                                setCollapsedGroupIds(previous => new Set(previous).add(item.group.groupId));
                            } else {
                                temporarilyCollapsedGroupIdRef.current = null;
                            }
                            setDragTargetGroupId(null);
                            setDragTargetTaskId(null);
                            setDragTargetPosition(null);
                            setDragTargetTop(false);
                            setDragTargetBottom(false);
                        } : undefined}
                        onDragOver={reorderable ? (event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            const activeGroupId = getDraggedGroupId();
                            const activeTaskIds = getDraggedTaskIds();
                            if (activeGroupId !== item.group.groupId || activeTaskIds.length > 0) {
                                const intent = activeGroupId ? taskDropEdge(event) : dropIntent(event);
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
                            boxShadow: selectedGroupIdSet.has(item.group.groupId)
                                ? theme => `inset 0 0 0 1.5px ${alpha(theme.palette.primary.main, 0.38)}`
                                : 'none',
                            opacity: groupDragging ? 0.42 : 1,
                            transform: groupDragging ? 'scale(0.98)' : 'scale(1)',
                            backgroundColor: selectedGroupIdSet.has(item.group.groupId)
                                ? theme => alpha(theme.palette.primary.main, 0.09)
                                : groupDragTarget && dragTargetPosition === 'inside' ? 'action.hover' : 'transparent',
                            transition: 'opacity 0.16s, transform 0.16s, background-color 0.18s',
                            '&:hover': {
                                backgroundColor: selectedGroupIdSet.has(item.group.groupId)
                                    ? theme => alpha(theme.palette.primary.main, 0.09)
                                    : 'action.hover',
                            },
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
                            sx={{ width: 38, height: 38, p: 0, mr: 0.5, flexShrink: 0 }}
                            onClick={event => {
                                event.stopPropagation();
                                toggleGroup(item.group.groupId);
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
                            <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left', position: 'relative', top: '-1px' }}>
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
                                    <Typography component="span" variant="body2" display="inline" sx={{ fontWeight: 650 }}>
                                        {item.group.name}
                                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                                            {item.tasks.length}
                                        </Typography>
                                    </Typography>
                                </Box>
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
                            disabled={groupTaskSubmitting || groupAddingTaskId === item.group.groupId}
                        >
                            {groupTaskSubmitting && groupAddingTaskId === item.group.groupId
                                ? <CircularProgress size={18} />
                                : <AddIcon fontSize="small" />}
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
                            <Collapse
                                in={groupAddingTaskId === item.group.groupId}
                                timeout={180}
                                unmountOnExit
                                sx={{
                                    willChange: 'height',
                                    '& .MuiCollapse-wrapper': { willChange: 'height' },
                                }}
                            >
                                <Fade in={groupAddingTaskId === item.group.groupId} timeout={150}>
                                    <GroupTaskInputRow
                                        groupName={item.group.name}
                                        disabled={groupTaskSubmitting}
                                        onSubmit={taskToCreate => {
                                            setGroupAddingTaskId(null);
                                            void createTaskInGroup(item.group, item.tasks[0]?.taskId, taskToCreate);
                                        }}
                                        onEscape={() => setGroupAddingTaskId(null)}
                                        onBlur={() => setGroupAddingTaskId(null)}
                                    />
                                </Fade>
                            </Collapse>
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
                        <SmartTaskInput onSubmit={createTask} />
                    </Box>

                    {selectionActionsVisible && selectionActionsPosition && (
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

                    {homeContentReady && visibleTasks.length > 0 ? (
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
                                            if (!hasActiveDrag()) return;
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
                                                if (!hasActiveDrag()) return;
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
                    ) : homeContentReady ? (
                        <Typography
                            variant="body1"
                            color="text.secondary"
                            onDragOver={(event) => {
                                if (!hasActiveDrag()) return;
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
                        in={homeContentReady && focusVisibility === 'all'
                            && showOlderTasks && olderTasks.length > 0}
                        timeout={{ enter: 260, exit: 220 }}
                        mountOnEnter
                        unmountOnExit
                    >
                        <Box
                            onClick={clearSelection}
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
                        in={homeContentReady && focusVisibility === 'all' && olderTasks.length > 0}
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
                                {deleteRequest.kind === 'group'
                                    ? `Delete “${deleteRequest.group.name}” and its ${deleteRequest.tasks.length} tasks?`
                                    : deleteRequest.kind === 'bulk'
                                    ? `Delete ${deleteRequest.tasks.length} selected task${deleteRequest.tasks.length > 1 ? 's' : ''} and their subtasks?`
                                    : `Delete “${deleteRequest.tasks[0].name}” and its subtasks?`}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                                <Button size="small" onClick={closeDeleteRequest} disabled={deleteSubmitting}>Cancel</Button>
                                {deleteRequest.kind === 'group' && (
                                    <Button
                                        size="small"
                                        onClick={() => void confirmUngroup()}
                                        disabled={deleteSubmitting}
                                    >
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
