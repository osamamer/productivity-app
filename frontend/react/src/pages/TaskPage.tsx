import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    IconButton,
    Popover,
    Portal,
    Snackbar,
    TextField,
    Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../hooks/useGlobalTasks';
import { TaskToCreate } from '../types/TaskToCreate';
import { TASK_PAGE_BATCH_SIZE, taskGroupService, taskService } from '../services/api';
import { TaskPageComposer } from '../components/task-page/TaskPageComposer';
import { TaskPageSection } from '../components/task-page/TaskPageSection';
import { buildTaskListItems } from '../components/task-page/taskPageSectionUtils';
import { TaskDetailsPanel } from '../components/task-page/TaskDetailsPanel';
import { Task } from '../types/Task';
import { TaskGroup } from '../types/TaskGroup';
import { getShowCompletedHomeTasks } from '../services/utils/homePreferences';
import { playAudioFeedback } from '../services/audioFeedback';
import { createTaskSearchMatcher, normalizeTaskSearchText } from '../services/utils/taskSearch';
import { findKeyboardDeleteAnchor, useKeyboardDelete } from '../hooks/useKeyboardDelete';
import { BulkTaskDatePopover } from '../components/task/BulkTaskDatePopover';
import { invalidateResource } from '../services/cache/resourceInvalidation';
import {
    readTaskSectionExpansion,
    saveTaskSectionExpansion,
    type TaskSectionExpansionState,
    type TaskSectionName,
} from '../services/utils/taskPagePreferences';

type DeleteRequest =
    | { kind: 'single' | 'bulk'; tasks: Task[]; anchorEl: HTMLElement }
    | { kind: 'group'; group: TaskGroup; tasks: Task[]; anchorEl: HTMLElement };
type DeleteScope = 'occurrence' | 'series';
type EditRequest = { taskId: string; requestId: number };
type BulkAction = 'complete' | 'reopen' | 'move-to-date' | 'clear-date';
type SelectionEntity =
    | { kind: 'task'; id: string }
    | { kind: 'group'; id: string };
type TaskFeedback = { id: number; severity: 'success' | 'error'; message: string };

const SELECTION_ACTIONS_EDGE_PADDING = 12;
const SELECTION_ACTIONS_GAP = 4;
const SELECTION_ACTIONS_FALLBACK_WIDTH = 136;

function sameTaskGroup(first: TaskGroup, second: TaskGroup): boolean {
    return first.groupId === second.groupId
        && first.name === second.name
        && first.displayOrder === second.displayOrder
        && first.taskIds.length === second.taskIds.length
        && first.taskIds.every((taskId, index) => taskId === second.taskIds[index]);
}

function replaceTaskGroupIfChanged(groups: TaskGroup[], updatedGroup: TaskGroup): TaskGroup[] {
    return groups.map(group => (
        group.groupId === updatedGroup.groupId && !sameTaskGroup(group, updatedGroup)
            ? updatedGroup
            : group
    ));
}

function formatLocalDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function compareUpcomingTasks(first: Task, second: Task): number {
    const firstDate = first.scheduledPerformDateTime
        ? Date.parse(first.scheduledPerformDateTime)
        : Number.POSITIVE_INFINITY;
    const secondDate = second.scheduledPerformDateTime
        ? Date.parse(second.scheduledPerformDateTime)
        : Number.POSITIVE_INFINITY;

    if (firstDate !== secondDate) return firstDate - secondDate;
    return first.taskId.localeCompare(second.taskId);
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
    const affectedTasks = new Map(request.tasks.map(task => [task.taskId, task]));
    allTasks.forEach(task => {
        if (selectedSeriesIds.has(task.taskSeriesId ?? '')) affectedTasks.set(task.taskId, task);
    });

    return [...affectedTasks.values()].filter(task => (
        selectedTaskIds.has(task.taskId) || selectedSeriesIds.has(task.taskSeriesId ?? '')
    ));
}

async function deleteTasksForScope(tasks: Task[], scope: DeleteScope): Promise<void> {
    const deletedSeriesIds = new Set<string>();
    const options = { notifyResource: false };
    await Promise.all(tasks.flatMap(task => {
        if (scope === 'series' && task.taskSeriesId) {
            if (deletedSeriesIds.has(task.taskSeriesId)) return [];
            deletedSeriesIds.add(task.taskSeriesId);
            return [taskService.deleteTask(task.taskId, options)];
        }

        return [scope === 'occurrence'
            ? taskService.deleteTaskInstance(task, options)
            : taskService.deleteTask(task.taskId, options)];
    }));
}

export function TaskPage() {
    const {
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        undatedTasks,
        highlightedTask,
        setHighlightedTask,
        loading,
        tasksLoaded,
        error,
        taskLoadVersion,
        taskPageHasMoreFutureTasks,
        taskPageHasMorePastTasks,
        refreshTaskBuckets,
        addTaskToState,
        appendTasksToState,
        replaceTaskInState,
        updateTaskInState,
        removeTaskFromState,
    } = useGlobalTasks({ taskPageMode: true });

    const [expandedSections, setExpandedSections] = useState<TaskSectionExpansionState>(readTaskSectionExpansion);
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>(() => taskGroupService.getCachedGroups() ?? []);
    const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [taskSelectionEnabled, setTaskSelectionEnabled] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [groupAnchorEl, setGroupAnchorEl] = useState<HTMLElement | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupSubmitting, setGroupSubmitting] = useState(false);
    const [bulkDateAnchorEl, setBulkDateAnchorEl] = useState<HTMLElement | null>(null);
    const [bulkDateDraft, setBulkDateDraft] = useState(() => new Date());
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [taskFeedback, setTaskFeedback] = useState<TaskFeedback | null>(null);
    const [selectionActionsPosition, setSelectionActionsPosition] = useState<{ top: number; left: number } | null>(null);
    const [draggedTaskIds, setDraggedTaskIds] = useState<string[]>([]);
    const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
    const allTasksRef = useRef(allTasks);
    const selectionAnchorRef = useRef<string | null>(null);
    const activeDraggedTaskIdsRef = useRef<string[]>([]);
    const taskFeedbackIdRef = useRef(0);
    const selectionActionsRef = useRef<HTMLDivElement | null>(null);
    const todayRef = useRef<HTMLDivElement>(null);
    const comingUpRef = useRef<HTMLDivElement>(null);
    const leftoversRef = useRef<HTMLDivElement>(null);
    const undatedRef = useRef<HTMLDivElement>(null);
    const [upcomingTaskLimit, setUpcomingTaskLimit] = useState(TASK_PAGE_BATCH_SIZE);
    const [leftoverTaskLimit, setLeftoverTaskLimit] = useState(TASK_PAGE_BATCH_SIZE);
    const [hasMoreUpcomingTasks, setHasMoreUpcomingTasks] = useState(taskPageHasMoreFutureTasks);
    const [hasMoreLeftoverTasks, setHasMoreLeftoverTasks] = useState(taskPageHasMorePastTasks);
    const [loadingMoreUpcomingTasks, setLoadingMoreUpcomingTasks] = useState(false);
    const [loadingMoreLeftoverTasks, setLoadingMoreLeftoverTasks] = useState(false);
    const initializedTaskLoadVersionRef = useRef<number | null>(null);
    const completionMutationRef = useRef<Map<string, Promise<void>>>(new Map());
    const completionRequestIdRef = useRef<Map<string, number>>(new Map());
    const completionConfirmedStateRef = useRef<Map<string, boolean>>(new Map());
    const showCompletedTasks = getShowCompletedHomeTasks();
    allTasksRef.current = allTasks;

    useEffect(() => {
        setHighlightedTask(null);
    }, [setHighlightedTask]);

    useEffect(() => {
        let active = true;
        void taskGroupService.getGroups()
            .then(groups => {
                if (active) setTaskGroups(groups);
            })
            .catch(error => {
                console.error('Error fetching task groups for Tasks page:', error);
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (initializedTaskLoadVersionRef.current === taskLoadVersion) return;
        initializedTaskLoadVersionRef.current = taskLoadVersion;
        setUpcomingTaskLimit(TASK_PAGE_BATCH_SIZE);
        setLeftoverTaskLimit(TASK_PAGE_BATCH_SIZE);
        setHasMoreUpcomingTasks(taskPageHasMoreFutureTasks);
        setHasMoreLeftoverTasks(taskPageHasMorePastTasks);
    }, [taskLoadVersion, taskPageHasMoreFutureTasks, taskPageHasMorePastTasks]);

    const createTask = useCallback(async (task: TaskToCreate) => {
        try {
            const createdTask = await taskService.createTask(task);
            addTaskToState(createdTask);
            setHighlightedTask(createdTask);
        } catch (error) {
            console.error('Error creating task:', error);
            await refreshTaskBuckets(true, 'taskPage');
        }
    }, [addTaskToState, refreshTaskBuckets, setHighlightedTask]);

    const createSubtask = useCallback(async (task: TaskToCreate): Promise<Task> => {
        try {
            return await taskService.createTask(task);
        } catch (error) {
            console.error('Error creating subtask:', error);
            throw error;
        }
    }, []);

    const toggleTaskCompletion = useCallback((taskId: string) => {
        const task = allTasksRef.current.find(candidate => candidate.taskId === taskId);
        if (!task) return;

        const previousCompleted = task.completed;
        const completed = !previousCompleted;
        const requestId = (completionRequestIdRef.current.get(taskId) ?? 0) + 1;
        if (!completionMutationRef.current.has(taskId)) {
            completionConfirmedStateRef.current.set(taskId, previousCompleted);
        }
        completionRequestIdRef.current.set(taskId, requestId);
        allTasksRef.current = allTasksRef.current.map(candidate => (
            candidate.taskId === taskId ? { ...candidate, completed } : candidate
        ));
        updateTaskInState(taskId, { completed });

        const persist = async () => {
            try {
                const updatedTask = await taskService.toggleTaskCompletion(taskId, completed);
                completionConfirmedStateRef.current.set(taskId, updatedTask.completed);
                if (!previousCompleted && updatedTask.completed) playAudioFeedback('taskCompleted');
            } catch (error) {
                console.error('Error toggling task:', error);
                const isLatestRequest = completionRequestIdRef.current.get(taskId) === requestId;
                const currentTask = allTasksRef.current.find(candidate => candidate.taskId === taskId);
                if (isLatestRequest && currentTask?.completed === completed) {
                    const rollbackCompleted = completionConfirmedStateRef.current.get(taskId)
                        ?? previousCompleted;
                    allTasksRef.current = allTasksRef.current.map(candidate => (
                        candidate.taskId === taskId
                            ? { ...candidate, completed: rollbackCompleted }
                            : candidate
                    ));
                    updateTaskInState(taskId, { completed: rollbackCompleted });
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
    }, [updateTaskInState]);

    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
        const originalTask = allTasksRef.current.find(task => task.taskId === taskId);
        updateTaskInState(taskId, updates);

        try {
            await taskService.updateTask(taskId, updates);
        } catch (error) {
            console.error('Error updating task:', error);
            if (originalTask) updateTaskInState(taskId, originalTask);
            await refreshTaskBuckets(true, 'taskPage');
        }
    }, [refreshTaskBuckets, updateTaskInState]);

    const clearSelection = useCallback(() => {
        setSelectedTaskIds([]);
        setSelectedGroupIds([]);
        setTaskSelectionEnabled(false);
        setHighlightedTask(null);
        setBulkDateAnchorEl(null);
        setGroupAnchorEl(null);
        setGroupName('');
        selectionAnchorRef.current = null;
    }, [setHighlightedTask]);

    const requestDelete = useCallback((task: Task, anchorEl: HTMLElement) => {
        if (deleteSubmitting) return;

        const tasks = selectedTaskIds.includes(task.taskId) && selectedTaskIds.length > 1
            ? allTasks.filter(candidate => selectedTaskIds.includes(candidate.taskId))
            : [task];
        setDeleteRequest({
            kind: tasks.length > 1 ? 'bulk' : 'single',
            tasks,
            anchorEl,
        });
    }, [allTasks, deleteSubmitting, selectedTaskIds]);

    const requestGroupDelete = useCallback((group: TaskGroup, anchorEl: HTMLElement) => {
        if (deleteSubmitting) return;
        setDeleteRequest({
            kind: 'group',
            group,
            tasks: allTasks.filter(task => group.taskIds.includes(task.taskId)),
            anchorEl,
        });
    }, [allTasks, deleteSubmitting]);

    const closeDeleteRequest = useCallback(() => {
        if (!deleteSubmitting) setDeleteRequest(null);
    }, [deleteSubmitting]);

    const confirmDelete = useCallback(async (scope: DeleteScope = 'occurrence') => {
        if (!deleteRequest || deleteSubmitting) return;

        const request = deleteRequest;
        const tasksToDelete = tasksForDeleteScope(request, scope, allTasks);
        setDeleteSubmitting(true);
        setDeleteRequest(null);
        try {
            if (request.kind === 'group') {
                await taskGroupService.deleteGroup(request.group.groupId);
            }
            await deleteTasksForScope(tasksToDelete, scope);
            tasksToDelete.forEach(task => removeTaskFromState(task.taskId));
            const deletedTaskIds = new Set(tasksToDelete.map(task => task.taskId));
            setTaskGroups(previous => previous
                .filter(group => request.kind !== 'group' || group.groupId !== request.group.groupId)
                .map(group => ({
                    ...group,
                    taskIds: group.taskIds.filter(taskId => !deletedTaskIds.has(taskId)),
                }))
                .filter(group => group.taskIds.length >= 2));
            clearSelection();
            invalidateResource('tasks');
        } catch (error) {
            console.error('Error deleting task:', error);
            await refreshTaskBuckets(true, 'taskPage');
            try {
                setTaskGroups(await taskGroupService.getGroups());
            } catch (refreshError) {
                console.error('Error refreshing task groups after deletion:', refreshError);
            }
        } finally {
            setDeleteSubmitting(false);
            setDeleteRequest(null);
        }
    }, [allTasks, clearSelection, deleteRequest, deleteSubmitting, refreshTaskBuckets, removeTaskFromState]);

    const confirmUngroup = useCallback(async () => {
        if (!deleteRequest || deleteRequest.kind !== 'group' || deleteSubmitting) return;

        const group = deleteRequest.group;
        setDeleteSubmitting(true);
        setDeleteRequest(null);
        try {
            await taskGroupService.deleteGroup(group.groupId);
            setTaskGroups(previous => previous.filter(existingGroup => existingGroup.groupId !== group.groupId));
            clearSelection();
        } catch (error) {
            console.error('Error ungrouping task group:', error);
            try {
                setTaskGroups(await taskGroupService.getGroups());
            } catch (refreshError) {
                console.error('Error refreshing task groups:', refreshError);
            }
        } finally {
            setDeleteSubmitting(false);
            setDeleteRequest(null);
        }
    }, [clearSelection, deleteRequest, deleteSubmitting]);

    const toggleSection = useCallback((section: TaskSectionName) => {
        setExpandedSections(previous => {
            const nextState = { ...previous, [section]: !previous[section] };
            saveTaskSectionExpansion(nextState);
            return nextState;
        });
    }, []);

    const handleTaskSelect = useCallback((task: Task) => {
        setTaskSelectionEnabled(true);
        setHighlightedTask(task);
    }, [setHighlightedTask]);

    const closeTaskDetails = useCallback(() => {
        setTaskSelectionEnabled(false);
        setHighlightedTask(null);
    }, [setHighlightedTask]);

    const isSearchActive = normalizeTaskSearchText(searchQuery).length > 0;
    const matchesSearch = useMemo(() => createTaskSearchMatcher(searchQuery), [searchQuery]);
    const visibleTodayTasks = useMemo(
        () => todayTasks.filter(task => !task.parentId
            && (showCompletedTasks || !task.completed)
            && matchesSearch(task)),
        [matchesSearch, showCompletedTasks, todayTasks],
    );
    const visibleFutureTasks = useMemo(
        () => futureTasks.filter(task => !task.parentId
            && (showCompletedTasks || !task.completed)
            && matchesSearch(task)),
        [futureTasks, matchesSearch, showCompletedTasks],
    );
    const futureTasksToShow = useMemo(() => {
        const sortedTasks = [...visibleFutureTasks].sort(compareUpcomingTasks);
        return sortedTasks.slice(0, upcomingTaskLimit);
    }, [upcomingTaskLimit, visibleFutureTasks]);
    const hiddenFutureTaskCount = visibleFutureTasks.length - futureTasksToShow.length;
    const nextUpcomingTaskCount = hiddenFutureTaskCount > 0
        ? Math.min(TASK_PAGE_BATCH_SIZE, hiddenFutureTaskCount)
        : TASK_PAGE_BATCH_SIZE;
    const filteredPastTasks = useMemo(
        () => pastTasks.filter(task => !task.parentId
            && (showCompletedTasks || !task.completed)
            && matchesSearch(task)),
        [matchesSearch, pastTasks, showCompletedTasks],
    );
    const visiblePastTasks = useMemo(
        () => [...filteredPastTasks]
            .sort((first, second) => compareUpcomingTasks(second, first))
            .slice(0, leftoverTaskLimit),
        [filteredPastTasks, leftoverTaskLimit],
    );
    const hiddenPastTaskCount = filteredPastTasks.length - visiblePastTasks.length;
    const nextLeftoverTaskCount = hiddenPastTaskCount > 0
        ? Math.min(TASK_PAGE_BATCH_SIZE, hiddenPastTaskCount)
        : TASK_PAGE_BATCH_SIZE;
    const visibleUndatedTasks = useMemo(
        () => undatedTasks.filter(task => !task.parentId
            && (showCompletedTasks || !task.completed)
            && matchesSearch(task)),
        [matchesSearch, showCompletedTasks, undatedTasks],
    );

    const renderedTaskLists = useMemo(
        () => [visibleTodayTasks, futureTasksToShow, visiblePastTasks, visibleUndatedTasks],
        [futureTasksToShow, visiblePastTasks, visibleTodayTasks, visibleUndatedTasks],
    );
    const renderedTaskItems = useMemo(
        () => renderedTaskLists.flatMap(tasks => buildTaskListItems(tasks, taskGroups)),
        [renderedTaskLists, taskGroups],
    );
    const renderedSelectionEntities = useMemo(() => {
        const entities: SelectionEntity[] = [];
        const seenTaskIds = new Set<string>();
        const seenGroupIds = new Set<string>();

        renderedTaskItems.forEach(item => {
            if (item.kind === 'task') {
                if (!seenTaskIds.has(item.task.taskId)) {
                    seenTaskIds.add(item.task.taskId);
                    entities.push({ kind: 'task', id: item.task.taskId });
                }
                return;
            }

            if (!seenGroupIds.has(item.group.groupId)) {
                seenGroupIds.add(item.group.groupId);
                entities.push({ kind: 'group', id: item.group.groupId });
            }
            item.tasks.forEach(task => {
                if (seenTaskIds.has(task.taskId)) return;
                seenTaskIds.add(task.taskId);
                entities.push({ kind: 'task', id: task.taskId });
            });
        });
        return entities;
    }, [renderedTaskItems]);

    const hasTodayTasks = visibleTodayTasks.length > 0;
    const hasFutureTasks = visibleFutureTasks.length > 0 || (!isSearchActive && hasMoreUpcomingTasks);
    const hasPastTasks = filteredPastTasks.length > 0 || (!isSearchActive && hasMoreLeftoverTasks);
    const hasUndatedTasks = visibleUndatedTasks.length > 0;
    const hasTasks = hasTodayTasks || hasFutureTasks || hasPastTasks || hasUndatedTasks;
    const visibleTaskIds = useMemo(
        () => new Set([
            ...visibleTodayTasks,
            ...visibleFutureTasks,
            ...visiblePastTasks,
            ...visibleUndatedTasks,
        ].map(task => task.taskId)),
        [visibleFutureTasks, visiblePastTasks, visibleTodayTasks, visibleUndatedTasks],
    );
    const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
    const draggedTaskIdSet = useMemo(() => new Set(draggedTaskIds), [draggedTaskIds]);
    const selectedGroupIdSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
    const selectedGroupTaskIdSet = useMemo(
        () => new Set(taskGroups
            .filter(group => selectedGroupIdSet.has(group.groupId))
            .flatMap(group => group.taskIds)),
        [selectedGroupIdSet, taskGroups],
    );
    const selectedActionTaskIdSet = useMemo(
        () => new Set([...selectedTaskIds, ...selectedGroupTaskIdSet]),
        [selectedGroupTaskIdSet, selectedTaskIds],
    );
    const selectedTasks = useMemo(
        () => allTasks.filter(task => selectedActionTaskIdSet.has(task.taskId)),
        [allTasks, selectedActionTaskIdSet],
    );
    const selectionEntityCount = selectedTaskIds.length + selectedGroupIds.length;
    const selectionActionsVisible = selectionEntityCount > 1 || selectedGroupIds.length > 0;
    const canGroupSelectedTasks = selectedGroupIds.length === 0 && selectedTaskIds.length >= 2;
    const selectedTask = taskSelectionEnabled
        && highlightedTask
        && visibleTaskIds.has(highlightedTask.taskId)
        ? highlightedTask
        : null;
    const selectedEditRequestId = editRequest && editRequest.taskId === selectedTask?.taskId
        ? editRequest.requestId
        : null;

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
        const top = (Math.min(...bounds.map(rect => rect.top + rect.height / 2))
            + Math.max(...bounds.map(rect => rect.top + rect.height / 2))) / 2;
        const right = Math.max(...bounds.map(rect => rect.right));
        const popupWidth = selectionActionsRef.current?.getBoundingClientRect().width
            ?? SELECTION_ACTIONS_FALLBACK_WIDTH;
        const maxLeft = window.innerWidth - popupWidth - SELECTION_ACTIONS_EDGE_PADDING;
        const left = Math.min(
            Math.max(right + SELECTION_ACTIONS_GAP, SELECTION_ACTIONS_EDGE_PADDING),
            Math.max(SELECTION_ACTIONS_EDGE_PADDING, maxLeft),
        );
        const nextPosition = { top: Math.round(top), left: Math.round(left) };
        setSelectionActionsPosition(previous => (
            previous?.top === nextPosition.top && previous.left === nextPosition.left
                ? previous
                : nextPosition
        ));
    }, [selectedActionTaskIdSet, selectedGroupIdSet, selectionActionsVisible]);

    useLayoutEffect(() => {
        if (!selectionActionsVisible) return undefined;

        updateSelectionActionsPosition();
        const handleViewportChange = () => updateSelectionActionsPosition();
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);
        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [expandedSections, renderedTaskItems, updateSelectionActionsPosition, selectionActionsVisible]);

    useEffect(() => {
        const knownTaskIds = new Set(allTasks.map(task => task.taskId));
        setSelectedTaskIds(previous => {
            const next = previous.filter(taskId => knownTaskIds.has(taskId));
            return next.length === previous.length ? previous : next;
        });
        setSelectedGroupIds(previous => {
            const next = previous.filter(groupId => taskGroups.some(group => group.groupId === groupId));
            return next.length === previous.length ? previous : next;
        });
    }, [allTasks, taskGroups]);

    const showTaskFeedback = useCallback((severity: TaskFeedback['severity'], message: string) => {
        taskFeedbackIdRef.current += 1;
        setTaskFeedback({ id: taskFeedbackIdRef.current, severity, message });
    }, []);

    const createTaskInGroup = useCallback(async (group: TaskGroup, taskToCreate: TaskToCreate) => {
        if (!taskToCreate.name.trim()) return;

        const currentGroup = taskGroups.find(candidate => candidate.groupId === group.groupId) ?? group;
        const optimisticTaskId = `optimistic-task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
            taskSeriesId: null,
            seriesOccurrenceAt: null,
            skipped: false,
        };
        const nextTaskIds = [...currentGroup.taskIds, optimisticTaskId];
        setTaskGroups(previous => previous.map(existingGroup => (
            existingGroup.groupId === currentGroup.groupId
                ? { ...existingGroup, taskIds: nextTaskIds }
                : existingGroup
        )));
        addTaskToState(optimisticTask);

        let createdTaskId: string | null = null;
        try {
            const createdTask = await taskService.createTask(taskToCreate);
            createdTaskId = createdTask.taskId;
            const nextTaskIdsWithCreatedTask = nextTaskIds.map(taskId => (
                taskId === optimisticTaskId ? createdTask.taskId : taskId
            ));
            setTaskGroups(previous => previous.map(existingGroup => (
                existingGroup.groupId === currentGroup.groupId
                    ? {
                        ...existingGroup,
                        taskIds: existingGroup.taskIds.map(taskId => (
                            taskId === optimisticTaskId ? createdTask.taskId : taskId
                        )),
                    }
                    : existingGroup
            )));
            replaceTaskInState(optimisticTaskId, createdTask);
            const updatedGroup = await taskGroupService.replaceTasks(
                currentGroup.groupId,
                nextTaskIdsWithCreatedTask,
            );
            setTaskGroups(previous => replaceTaskGroupIfChanged(previous, updatedGroup));
        } catch (error) {
            console.error('Error creating task in group:', error);
            if (createdTaskId === null) {
                removeTaskFromState(optimisticTaskId);
                setTaskGroups(previous => previous.map(existingGroup => (
                    existingGroup.groupId === currentGroup.groupId
                        ? { ...existingGroup, taskIds: existingGroup.taskIds.filter(taskId => taskId !== optimisticTaskId) }
                        : existingGroup
                )));
            } else {
                try {
                    setTaskGroups(await taskGroupService.getGroups());
                } catch (refreshError) {
                    console.error('Error refreshing task groups after creation:', refreshError);
                }
            }
            showTaskFeedback('error', 'Could not add the task to that group');
        }
    }, [addTaskToState, removeTaskFromState, replaceTaskInState, showTaskFeedback, taskGroups]);

    const handleTaskSelection = useCallback((task: Task, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setTaskSelectionEnabled(true);
        const taskId = task.taskId;
        const anchorId = selectionAnchorRef.current;

        if (event.shiftKey && anchorId) {
            const anchorIndex = renderedSelectionEntities.findIndex(entity => entity.kind === 'task' && entity.id === anchorId);
            const taskIndex = renderedSelectionEntities.findIndex(entity => entity.kind === 'task' && entity.id === taskId);
            if (anchorIndex !== -1 && taskIndex !== -1) {
                const range = renderedSelectionEntities.slice(
                    Math.min(anchorIndex, taskIndex),
                    Math.max(anchorIndex, taskIndex) + 1,
                );
                setSelectedTaskIds(previous => [...new Set([
                    ...previous,
                    ...range.filter(entity => entity.kind === 'task').map(entity => entity.id),
                ])]);
                setSelectedGroupIds(previous => [...new Set([
                    ...previous,
                    ...range.filter(entity => entity.kind === 'group').map(entity => entity.id),
                ])]);
                setHighlightedTask(task);
                return;
            }
        }

        if (event.ctrlKey || event.metaKey) {
            setSelectedTaskIds(previous => previous.includes(taskId)
                ? previous.filter(selectedTaskId => selectedTaskId !== taskId)
                : [...previous, taskId]);
            setSelectedGroupIds([]);
            setHighlightedTask(selectedTaskIds.includes(taskId) ? null : task);
            selectionAnchorRef.current = taskId;
            return;
        }

        setSelectedTaskIds([taskId]);
        setSelectedGroupIds([]);
        setHighlightedTask(task);
        selectionAnchorRef.current = taskId;
    }, [renderedSelectionEntities, selectedTaskIds, setHighlightedTask]);

    const handleGroupSelection = useCallback((group: TaskGroup, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setTaskSelectionEnabled(true);
        const groupId = group.groupId;
        const anchorId = selectionAnchorRef.current;

        if (event.shiftKey && anchorId) {
            const anchorIndex = renderedSelectionEntities.findIndex(entity => entity.id === anchorId);
            const groupIndex = renderedSelectionEntities.findIndex(entity => entity.kind === 'group' && entity.id === groupId);
            if (anchorIndex !== -1 && groupIndex !== -1) {
                const range = renderedSelectionEntities.slice(
                    Math.min(anchorIndex, groupIndex),
                    Math.max(anchorIndex, groupIndex) + 1,
                );
                setSelectedTaskIds(previous => [...new Set([
                    ...previous,
                    ...range.filter(entity => entity.kind === 'task').map(entity => entity.id),
                ])]);
                setSelectedGroupIds(previous => [...new Set([
                    ...previous,
                    ...range.filter(entity => entity.kind === 'group').map(entity => entity.id),
                ])]);
                return;
            }
        }

        setSelectedGroupIds(previous => previous.includes(groupId)
            ? previous.filter(selectedGroupId => selectedGroupId !== groupId)
            : [...previous, groupId]);
        setSelectedTaskIds([]);
        setHighlightedTask(null);
        selectionAnchorRef.current = groupId;
    }, [renderedSelectionEntities, setHighlightedTask]);

    const requestBulkDelete = useCallback((anchorEl: HTMLElement) => {
        if (bulkActionLoading || selectedTasks.length === 0) return;
        setDeleteRequest({ kind: 'bulk', tasks: selectedTasks, anchorEl });
    }, [bulkActionLoading, selectedTasks]);

    useKeyboardDelete({
        enabled: selectionEntityCount > 0 && !deleteRequest && !deleteSubmitting && !bulkActionLoading,
        onDelete: () => {
            const selectedGroupId = [...selectedGroupIds].reverse().find(groupId =>
                taskGroups.some(group => group.groupId === groupId),
            );
            if (selectedGroupId) {
                const group = taskGroups.find(candidate => candidate.groupId === selectedGroupId);
                if (group) {
                    setDeleteRequest({
                        kind: 'group',
                        group,
                        tasks: allTasks.filter(task => group.taskIds.includes(task.taskId)),
                        anchorEl: findKeyboardDeleteAnchor('data-task-group-id', group.groupId) ?? document.body,
                    });
                }
                return;
            }

            if (selectedTasks.length === 1) {
                const task = selectedTasks[0];
                requestDelete(task, findKeyboardDeleteAnchor('data-task-id', task.taskId) ?? document.body);
            } else if (selectedTasks.length > 1) {
                requestBulkDelete(findKeyboardDeleteAnchor('data-task-id', selectedTasks[selectedTasks.length - 1].taskId) ?? document.body);
            }
        },
    });

    const renameGroup = useCallback(async (group: TaskGroup, name: string) => {
        try {
            const updatedGroup = await taskGroupService.renameGroup(group.groupId, name);
            setTaskGroups(previous => replaceTaskGroupIfChanged(previous, updatedGroup));
        } catch (error) {
            console.error('Error renaming task group:', error);
            try {
                setTaskGroups(await taskGroupService.getGroups());
            } catch (refreshError) {
                console.error('Error refreshing task groups:', refreshError);
            }
        }
    }, []);

    const performBulkAction = useCallback(async (action: BulkAction, scheduledDateTime?: string) => {
        if (bulkActionLoading || selectedTasks.length === 0) return;
        if (action === 'move-to-date' && !scheduledDateTime) return;

        setBulkActionLoading(true);
        try {
            const updatedTasks = await Promise.all(selectedTasks.map(task => {
                if (action === 'move-to-date') {
                    return taskService.updateTask(task.taskId, { scheduledPerformDateTime: scheduledDateTime });
                }
                if (action === 'clear-date') {
                    return taskService.updateTask(task.taskId, { scheduledPerformDateTime: '' });
                }
                return taskService.updateTask(task.taskId, { completed: action === 'complete' });
            }));
            updatedTasks.forEach(updatedTask => updateTaskInState(updatedTask.taskId, updatedTask));
            setBulkDateAnchorEl(null);
            showTaskFeedback(
                'success',
                action === 'clear-date'
                    ? `${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'} cleared`
                    : `${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'} updated`,
            );
            clearSelection();
        } catch (error) {
            console.error(`Error applying bulk task action (${action}):`, error);
            await refreshTaskBuckets(true, 'taskPage');
            showTaskFeedback('error', 'Could not update the selected tasks');
        } finally {
            setBulkActionLoading(false);
        }
    }, [bulkActionLoading, clearSelection, refreshTaskBuckets, selectedTasks, showTaskFeedback, updateTaskInState]);

    const openBulkDatePicker = useCallback((anchorEl: HTMLElement) => {
        const firstScheduledDate = selectedTasks
            .map(task => task.scheduledPerformDateTime ? new Date(task.scheduledPerformDateTime) : null)
            .find((value): value is Date => value !== null && !Number.isNaN(value.getTime()));
        setBulkDateDraft(firstScheduledDate ?? new Date());
        setBulkDateAnchorEl(anchorEl);
    }, [selectedTasks]);

    const createGroup = useCallback(async () => {
        const trimmedName = groupName.trim();
        if (!trimmedName || !canGroupSelectedTasks || groupSubmitting) return;

        setGroupSubmitting(true);
        try {
            const taskIdsForGroup = selectedTasks.map(task => task.taskId);
            const selectedTaskIdSet = new Set(taskIdsForGroup);
            const createdGroup = await taskGroupService.createGroup(trimmedName, taskIdsForGroup);
            setTaskGroups(previous => [
                ...previous
                    .map(group => ({
                        ...group,
                        taskIds: group.taskIds.filter(taskId => !selectedTaskIdSet.has(taskId)),
                    }))
                    .filter(group => group.taskIds.length >= 2),
                createdGroup,
            ]);
            clearSelection();
        } catch (error) {
            console.error('Error creating task group:', error);
            showTaskFeedback('error', 'Could not create the task group');
        } finally {
            setGroupSubmitting(false);
        }
    }, [canGroupSelectedTasks, clearSelection, groupName, groupSubmitting, selectedTasks, showTaskFeedback]);

    const addTasksToGroup = useCallback(async (targetGroup: TaskGroup, taskIds: string[]) => {
        const taskIdsToAdd = taskIds.filter(taskId => !targetGroup.taskIds.includes(taskId));
        if (taskIdsToAdd.length === 0) return;

        const nextTaskIds = [...targetGroup.taskIds, ...taskIdsToAdd];
        const movedTaskIdSet = new Set(taskIdsToAdd);
        setTaskGroups(previous => previous
            .map(group => group.groupId === targetGroup.groupId
                ? { ...group, taskIds: nextTaskIds }
                : { ...group, taskIds: group.taskIds.filter(taskId => !movedTaskIdSet.has(taskId)) })
            .filter(group => group.taskIds.length >= 2));

        try {
            const updatedGroup = await taskGroupService.replaceTasks(targetGroup.groupId, nextTaskIds);
            setTaskGroups(previous => previous
                .map(group => {
                    if (group.groupId === updatedGroup.groupId) return updatedGroup;
                    const remainingTaskIds = group.taskIds.filter(taskId => !movedTaskIdSet.has(taskId));
                    return remainingTaskIds.length === group.taskIds.length
                        ? group
                        : { ...group, taskIds: remainingTaskIds };
                })
                .filter(group => group.taskIds.length >= 2));
        } catch (error) {
            console.error('Error adding task to group:', error);
            try {
                setTaskGroups(await taskGroupService.getGroups());
            } catch (refreshError) {
                console.error('Error refreshing task groups:', refreshError);
            }
            showTaskFeedback('error', 'Could not add the task to that group');
        }
    }, [showTaskFeedback]);

    const handleTaskDragStart = useCallback((task: Task) => {
        const renderedTaskIds = renderedTaskItems.flatMap(item => (
            item.kind === 'task'
                ? [item.task.taskId]
                : item.tasks.map(groupTask => groupTask.taskId)
        ));
        const taskIdsToDrag = selectedActionTaskIdSet.has(task.taskId)
            ? renderedTaskIds.filter(taskId => selectedActionTaskIdSet.has(taskId))
            : [task.taskId];
        activeDraggedTaskIdsRef.current = taskIdsToDrag;
        setDraggedTaskIds(taskIdsToDrag);
        setDragTargetGroupId(null);
    }, [renderedTaskItems, selectedActionTaskIdSet]);

    const handleTaskDragEnd = useCallback(() => {
        activeDraggedTaskIdsRef.current = [];
        setDraggedTaskIds([]);
        setDragTargetGroupId(null);
    }, []);

    const handleGroupDragOver = useCallback((group: TaskGroup, event: React.DragEvent<HTMLElement>) => {
        if (activeDraggedTaskIdsRef.current.length === 0) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragTargetGroupId(group.groupId);
    }, []);

    const handleGroupDrop = useCallback((group: TaskGroup, event: React.DragEvent<HTMLElement>) => {
        const taskIdsToAdd = activeDraggedTaskIdsRef.current;
        if (taskIdsToAdd.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        activeDraggedTaskIdsRef.current = [];
        setDraggedTaskIds([]);
        setDragTargetGroupId(null);
        void addTasksToGroup(group, taskIdsToAdd);
    }, [addTasksToGroup]);

    const loadMoreUpcomingTasks = useCallback(async () => {
        if (loadingMoreUpcomingTasks) return;
        if (!hasMoreUpcomingTasks) {
            setUpcomingTaskLimit(previous => previous + TASK_PAGE_BATCH_SIZE);
            return;
        }

        setLoadingMoreUpcomingTasks(true);
        try {
            const completedFilter = showCompletedTasks ? undefined : false;
            const loadedTaskCount = showCompletedTasks
                ? futureTasks.length
                : futureTasks.filter(task => !task.completed).length;
            const nextTasks = await taskService.getFutureTasks(
                TASK_PAGE_BATCH_SIZE,
                loadedTaskCount,
                completedFilter,
            );
            appendTasksToState(nextTasks);
            setUpcomingTaskLimit(previous => previous + TASK_PAGE_BATCH_SIZE);
            const hasMore = nextTasks.length === TASK_PAGE_BATCH_SIZE
                && (await taskService.getFutureTasks(
                    1,
                    loadedTaskCount + nextTasks.length,
                    completedFilter,
                )).length > 0;
            setHasMoreUpcomingTasks(hasMore);
        } catch (error) {
            console.error('Error fetching more upcoming tasks:', error);
        } finally {
            setLoadingMoreUpcomingTasks(false);
        }
    }, [appendTasksToState, futureTasks, hasMoreUpcomingTasks, loadingMoreUpcomingTasks, showCompletedTasks]);

    const loadMoreLeftoverTasks = useCallback(async () => {
        if (loadingMoreLeftoverTasks) return;
        if (!hasMoreLeftoverTasks) {
            setLeftoverTaskLimit(previous => previous + TASK_PAGE_BATCH_SIZE);
            return;
        }

        setLoadingMoreLeftoverTasks(true);
        try {
            const completedFilter = showCompletedTasks ? undefined : false;
            const loadedTaskCount = showCompletedTasks
                ? pastTasks.length
                : pastTasks.filter(task => !task.completed).length;
            const nextTasks = await taskService.getPastTasks(
                TASK_PAGE_BATCH_SIZE,
                loadedTaskCount,
                completedFilter,
            );
            appendTasksToState(nextTasks);
            setLeftoverTaskLimit(previous => previous + TASK_PAGE_BATCH_SIZE);
            const hasMore = nextTasks.length === TASK_PAGE_BATCH_SIZE
                && (await taskService.getPastTasks(
                    1,
                    loadedTaskCount + nextTasks.length,
                    completedFilter,
                )).length > 0;
            setHasMoreLeftoverTasks(hasMore);
        } catch (error) {
            console.error('Error fetching more older tasks:', error);
        } finally {
            setLoadingMoreLeftoverTasks(false);
        }
    }, [appendTasksToState, hasMoreLeftoverTasks, loadingMoreLeftoverTasks, pastTasks, showCompletedTasks]);

    useEffect(() => {
        const handleRightArrow = (event: KeyboardEvent) => {
            if (event.key !== 'ArrowRight' || event.defaultPrevented || event.altKey
                || event.ctrlKey || event.metaKey || event.shiftKey || !selectedTask) return;

            const target = event.target;
            if (target instanceof Element && target.closest(
                'input, textarea, select, button, [role="button"], [contenteditable="true"]',
            )) return;

            event.preventDefault();
            setEditRequest(previous => ({
                taskId: selectedTask.taskId,
                requestId: (previous?.requestId ?? 0) + 1,
            }));
        };

        window.addEventListener('keydown', handleRightArrow);
        return () => window.removeEventListener('keydown', handleRightArrow);
    }, [selectedTask]);

    useEffect(() => {
        const handleTaskDetailsTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab' || event.shiftKey || !selectedTask) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('[data-task-details="true"]')
                || target.closest('[data-task-id]')?.getAttribute('data-task-id') !== selectedTask.taskId) return;

            const firstDetailsControl = document.querySelector<HTMLElement>('[data-task-details-first-focus="true"]');
            if (!firstDetailsControl) return;
            event.preventDefault();
            firstDetailsControl.focus();
        };

        window.addEventListener('keydown', handleTaskDetailsTab);
        return () => window.removeEventListener('keydown', handleTaskDetailsTab);
    }, [selectedTask]);

    const sectionRefs: Record<TaskSectionName, React.RefObject<HTMLDivElement>> = {
        today: todayRef,
        comingUp: comingUpRef,
        leftovers: leftoversRef,
        undated: undatedRef,
    };

    const sharedSectionProps = {
        groups: taskGroups,
        onTaskClick: handleTaskSelect,
        onTaskSelection: handleTaskSelection,
        selectedTaskId: selectedTask?.taskId,
        selectedTaskIds: selectedTaskIdSet,
        selectedGroupTaskIds: selectedGroupTaskIdSet,
        selectedGroupIds: selectedGroupIdSet,
        onGroupSelection: handleGroupSelection,
        onRenameGroup: renameGroup,
        onCreateTaskInGroup: createTaskInGroup,
        onDeleteGroup: requestGroupDelete,
        onGroupDragOver: handleGroupDragOver,
        onGroupDrop: handleGroupDrop,
        dragTargetGroupId,
        onTaskDragStart: handleTaskDragStart,
        onTaskDragEnd: handleTaskDragEnd,
        draggedTaskIds: draggedTaskIdSet,
        editRequestId: selectedEditRequestId,
        toggleTaskCompletion,
        updateTask,
    };

    const handlePageClick = (event: React.MouseEvent<HTMLElement>) => {
        const target = event.target;
        if (target instanceof Element && (
            target.closest('[data-task-id]') || target.closest('[data-task-details]')
            || target.closest('[data-task-search]')
        )) {
            return;
        }
        clearSelection();
    };

    return (
        <PageWrapper>
            <Box
                onClick={handlePageClick}
                sx={{
                    flex: 1,
                    width: '100%',
                }}
            >
                <Box
                    sx={{
                        flex: 1,
                        width: '100%',
                        maxWidth: 1600,
                        ml: { xs: 'auto', lg: 0 },
                        mr: 'auto',
                        px: { xs: 1, sm: 3 },
                        py: { xs: 2, md: 4 },
                        boxSizing: 'border-box',
                    }}
                >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: 'minmax(0, 1fr)',
                            lg: 'minmax(0, 1fr) minmax(400px, 460px)',
                            xl: 'minmax(480px, 0.85fr) minmax(600px, 1.15fr)',
                        },
                        gap: { xs: 4, lg: 5, xl: 6 },
                        alignItems: 'start',
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <TaskPageComposer
                            onCreateTask={createTask}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                        />

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
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        aria-label={selectedTasks.length > 0 && selectedTasks.every(task => task.completed)
                                            ? 'Reopen selected tasks'
                                            : 'Complete selected tasks'}
                                        title={selectedTasks.length > 0 && selectedTasks.every(task => task.completed)
                                            ? 'Reopen selected tasks'
                                            : 'Complete selected tasks'}
                                        onClick={() => void performBulkAction(
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

                        {loading && !tasksLoaded && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress size={22} aria-label="Loading tasks" />
                            </Box>
                        )}

                        {!loading && !tasksLoaded && error && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                Tasks could not be loaded. Please try again.
                            </Alert>
                        )}

                        {tasksLoaded && (
                        <Box>
                            {(!isSearchActive || hasTodayTasks) && (
                                <TaskPageSection
                                    section="today"
                                    title="Today"
                                    tasks={visibleTodayTasks}
                                    completedCount={visibleTodayTasks.filter(task => task.completed).length}
                                    expanded={isSearchActive || expandedSections.today}
                                    onToggle={toggleSection}
                                    {...sharedSectionProps}
                                    emptyMessage="No matching tasks scheduled for today"
                                    sectionRef={sectionRefs.today}
                                />
                            )}

                            {hasFutureTasks && (
                                <TaskPageSection
                                    section="comingUp"
                                    title="Coming up"
                                    tasks={futureTasksToShow}
                                    completedCount={futureTasksToShow.filter(task => task.completed).length}
                                    expanded={isSearchActive || expandedSections.comingUp}
                                    onToggle={toggleSection}
                                    {...sharedSectionProps}
                                    emptyMessage="No matching upcoming tasks"
                                    sectionRef={sectionRefs.comingUp}
                                    showScheduledDate
                                    showMore={(hiddenFutureTaskCount > 0 || hasMoreUpcomingTasks) ? {
                                        count: nextUpcomingTaskCount,
                                        label: `Show next ${nextUpcomingTaskCount} upcoming ${nextUpcomingTaskCount === 1 ? 'task' : 'tasks'}`,
                                        loading: loadingMoreUpcomingTasks,
                                        onClick: loadMoreUpcomingTasks,
                                    } : undefined}
                                />
                            )}

                            {hasPastTasks && (
                                <TaskPageSection
                                    section="leftovers"
                                    title="Leftovers"
                                    tasks={visiblePastTasks}
                                    completedCount={visiblePastTasks.filter(task => task.completed).length}
                                    expanded={isSearchActive || expandedSections.leftovers}
                                    onToggle={toggleSection}
                                    {...sharedSectionProps}
                                    emptyMessage="No matching older tasks"
                                    sectionRef={sectionRefs.leftovers}
                                    showScheduledDate
                                    showMore={(hiddenPastTaskCount > 0 || hasMoreLeftoverTasks) ? {
                                        count: nextLeftoverTaskCount,
                                        label: `Show next ${nextLeftoverTaskCount} older ${nextLeftoverTaskCount === 1 ? 'task' : 'tasks'}`,
                                        loading: loadingMoreLeftoverTasks,
                                        onClick: loadMoreLeftoverTasks,
                                    } : undefined}
                                />
                            )}

                            {hasUndatedTasks && (
                                <TaskPageSection
                                    section="undated"
                                    title="No date"
                                    tasks={visibleUndatedTasks}
                                    completedCount={visibleUndatedTasks.filter(task => task.completed).length}
                                    expanded={isSearchActive || expandedSections.undated}
                                    onToggle={toggleSection}
                                    {...sharedSectionProps}
                                    emptyMessage="No matching undated tasks"
                                    sectionRef={sectionRefs.undated}
                                />
                            )}
                        </Box>
                        )}

                        {tasksLoaded && !loading && !hasTasks && (
                            <Typography variant="body1" color="text.secondary" sx={{ py: 2 }}>
                                {isSearchActive
                                    ? `No tasks match “${searchQuery.trim()}”.`
                                    : 'Nothing to do. Enjoy your free time!'}
                            </Typography>
                        )}
                    </Box>

                    <Box
                        sx={{
                            minWidth: 0,
                            position: { lg: 'sticky' },
                            top: { lg: 24 },
                            alignSelf: 'start',
                        }}
                    >
                        {selectedTask ? (
                            <TaskDetailsPanel
                                task={selectedTask}
                                onClose={closeTaskDetails}
                                onUpdate={updateTask}
                                onToggleCompletion={toggleTaskCompletion}
                                onDelete={requestDelete}
                                onCreateSubtask={createSubtask}
                                onRefreshTasks={() => refreshTaskBuckets(true, 'taskPage')}
                            />
                        ) : null}
                    </Box>
                </Box>
            </Box>
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
                                    ? `Delete ${deleteRequest.tasks.length} selected tasks?`
                                    : deleteRequest.tasks[0].taskSeriesId
                                        ? `Delete instance of “${deleteRequest.tasks[0].name}”?`
                                        : `Delete “${deleteRequest.tasks[0].name}” and its subtasks?`}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: 0.5,
                                    '& .MuiButton-root': {
                                        fontSize: '0.7rem',
                                        minWidth: 0,
                                        px: 0.75,
                                    },
                                }}
                            >
                            <Button size="small" onClick={closeDeleteRequest} disabled={deleteSubmitting}>
                                Cancel
                            </Button>
                            {deleteRequest.kind === 'group' && (
                                <Button
                                    size="small"
                                    onClick={() => void confirmUngroup()}
                                    disabled={deleteSubmitting}
                                >
                                    Ungroup
                                </Button>
                            )}
                            {requestHasRecurringTasks(deleteRequest) ? (
                                <>
                                    <Button
                                        size="small"
                                        onClick={() => void confirmDelete('occurrence')}
                                        disabled={deleteSubmitting}
                                    >
                                        Delete instance(s)
                                    </Button>
                                    <Button
                                        size="small"
                                        color="error"
                                        variant="contained"
                                        onClick={() => void confirmDelete('series')}
                                        disabled={deleteSubmitting}
                                    >
                                        {deleteSubmitting ? 'Deleting…' : 'Delete series'}
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    size="small"
                                    color="error"
                                    variant="contained"
                                    onClick={() => void confirmDelete()}
                                    disabled={deleteSubmitting}
                                >
                                    {deleteSubmitting ? 'Deleting…' : 'Delete'}
                                </Button>
                            )}
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
                slotProps={{ paper: { sx: { p: 1.25, width: 260 } } }}
            >
                <Box
                    component="form"
                    onSubmit={event => {
                        event.preventDefault();
                        void createGroup();
                    }}
                    onClick={event => event.stopPropagation()}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                        Group selected tasks
                    </Typography>
                    <TextField
                        autoFocus
                        size="small"
                        fullWidth
                        label="Group name"
                        value={groupName}
                        onChange={event => setGroupName(event.target.value)}
                        disabled={groupSubmitting}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 0.75 }}>
                        <Button size="small" onClick={() => setGroupAnchorEl(null)} disabled={groupSubmitting}>
                            Cancel
                        </Button>
                        <Button size="small" type="submit" variant="contained" disabled={groupSubmitting || !groupName.trim()}>
                            {groupSubmitting ? <CircularProgress size={16} color="inherit" /> : 'Group'}
                        </Button>
                    </Box>
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
                autoHideDuration={2200}
                onClose={() => setTaskFeedback(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                {taskFeedback ? (
                    <Alert
                        severity={taskFeedback.severity}
                        variant="outlined"
                        icon={<InfoOutlinedIcon fontSize="small" />}
                    >
                        {taskFeedback.message}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </PageWrapper>
    );
}

export default TaskPage;
