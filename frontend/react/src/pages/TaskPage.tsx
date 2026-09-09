import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Popover, Typography } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../hooks/useGlobalTasks';
import { TaskToCreate } from '../types/TaskToCreate';
import { TASK_PAGE_BATCH_SIZE, taskGroupService, taskService } from '../services/api';
import { TaskPageComposer } from '../components/task-page/TaskPageComposer';
import { TaskPageSection } from '../components/task-page/TaskPageSection';
import { TaskDetailsPanel } from '../components/task-page/TaskDetailsPanel';
import { Task } from '../types/Task';
import { TaskGroup } from '../types/TaskGroup';
import { getShowCompletedHomeTasks } from '../services/utils/homePreferences';
import { playAudioFeedback } from '../services/audioFeedback';
import { createTaskSearchMatcher, normalizeTaskSearchText } from '../services/utils/taskSearch';
import { findKeyboardDeleteAnchor, useKeyboardDelete } from '../hooks/useKeyboardDelete';
import {
    readTaskSectionExpansion,
    saveTaskSectionExpansion,
    type TaskSectionExpansionState,
    type TaskSectionName,
} from '../services/utils/taskPagePreferences';

type DeleteRequest = { task: Task; anchorEl: HTMLElement };
type EditRequest = { taskId: string; requestId: number };

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
        taskLoadVersion,
        refreshTaskBuckets,
        addTaskToState,
        appendTasksToState,
        updateTaskInState,
        removeTaskFromState,
    } = useGlobalTasks({ taskPageMode: true });

    const [expandedSections, setExpandedSections] = useState<TaskSectionExpansionState>(readTaskSectionExpansion);
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>(() => taskGroupService.getCachedGroups() ?? []);
    const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const allTasksRef = useRef(allTasks);
    const todayRef = useRef<HTMLDivElement>(null);
    const comingUpRef = useRef<HTMLDivElement>(null);
    const leftoversRef = useRef<HTMLDivElement>(null);
    const undatedRef = useRef<HTMLDivElement>(null);
    const [upcomingTaskLimit, setUpcomingTaskLimit] = useState(TASK_PAGE_BATCH_SIZE);
    const [leftoverTaskLimit, setLeftoverTaskLimit] = useState(TASK_PAGE_BATCH_SIZE);
    const [hasMoreUpcomingTasks, setHasMoreUpcomingTasks] = useState(false);
    const [hasMoreLeftoverTasks, setHasMoreLeftoverTasks] = useState(false);
    const [loadingMoreUpcomingTasks, setLoadingMoreUpcomingTasks] = useState(false);
    const [loadingMoreLeftoverTasks, setLoadingMoreLeftoverTasks] = useState(false);
    const initializedTaskLoadVersionRef = useRef<number | null>(null);
    const showCompletedTasks = getShowCompletedHomeTasks();
    allTasksRef.current = allTasks;

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
        setHasMoreUpcomingTasks(false);
        setHasMoreLeftoverTasks(false);

        const completedFilter = showCompletedTasks ? undefined : false;
        const checkForMore = async (
            loadedTaskCount: number,
            fetchPage: (limit: number, offset: number, completed?: boolean) => Promise<Task[]>,
        ): Promise<boolean> => {
            if (loadedTaskCount < TASK_PAGE_BATCH_SIZE) return false;
            const nextTasks = await fetchPage(1, loadedTaskCount, completedFilter);
            return nextTasks.length > 0;
        };

        let active = true;
        void Promise.all([
            checkForMore(futureTasks.length, (limit, offset, completed) => (
                taskService.getFutureTasks(limit, offset, completed)
            )),
            checkForMore(pastTasks.length, (limit, offset, completed) => (
                taskService.getPastTasks(limit, offset, completed)
            )),
        ]).then(([hasMoreUpcoming, hasMoreLeftover]) => {
            if (!active) return;
            setHasMoreUpcomingTasks(hasMoreUpcoming);
            setHasMoreLeftoverTasks(hasMoreLeftover);
        }).catch(error => {
            console.error('Error checking for more task pages:', error);
        });

        return () => {
            active = false;
        };
    }, [futureTasks.length, pastTasks.length, showCompletedTasks, taskLoadVersion]);

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

    const toggleTaskCompletion = useCallback(async (taskId: string) => {
        const task = allTasksRef.current.find(candidate => candidate.taskId === taskId);
        if (task) {
            updateTaskInState(taskId, { completed: !task.completed });
        }

        try {
            const updatedTask = await taskService.toggleTaskCompletion(taskId, task ? !task.completed : undefined);
            if (!task?.completed && updatedTask.completed) playAudioFeedback('taskCompleted');
        } catch (error) {
            console.error('Error toggling task:', error);
            if (task) updateTaskInState(taskId, { completed: task.completed });
        }
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

    const requestDelete = useCallback((task: Task, anchorEl: HTMLElement) => {
        if (!deleteSubmitting) setDeleteRequest({ task, anchorEl });
    }, [deleteSubmitting]);

    const closeDeleteRequest = useCallback(() => {
        if (!deleteSubmitting) setDeleteRequest(null);
    }, [deleteSubmitting]);

    const confirmDelete = useCallback(async () => {
        if (!deleteRequest || deleteSubmitting) return;

        const task = deleteRequest.task;
        setDeleteSubmitting(true);
        setDeleteRequest(null);
        try {
            await taskService.deleteTask(task.taskId);
            removeTaskFromState(task.taskId);
            if (highlightedTask?.taskId === task.taskId) setHighlightedTask(null);
        } catch (error) {
            console.error('Error deleting task:', error);
            await refreshTaskBuckets(true, 'taskPage');
        } finally {
            setDeleteSubmitting(false);
            setDeleteRequest(null);
        }
    }, [deleteRequest, deleteSubmitting, highlightedTask, refreshTaskBuckets, removeTaskFromState, setHighlightedTask]);

    const toggleSection = useCallback((section: TaskSectionName) => {
        setExpandedSections(previous => {
            const nextState = { ...previous, [section]: !previous[section] };
            saveTaskSectionExpansion(nextState);
            return nextState;
        });
    }, []);

    const handleTaskSelect = useCallback((task: Task) => {
        setHighlightedTask(task);
    }, [setHighlightedTask]);

    const closeTaskDetails = useCallback(() => {
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

    const hasTodayTasks = visibleTodayTasks.length > 0;
    const hasFutureTasks = visibleFutureTasks.length > 0 || hasMoreUpcomingTasks;
    const hasPastTasks = filteredPastTasks.length > 0 || hasMoreLeftoverTasks;
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
    const selectedTask = highlightedTask && visibleTaskIds.has(highlightedTask.taskId)
        ? highlightedTask
        : null;
    const selectedEditRequestId = editRequest && editRequest.taskId === selectedTask?.taskId
        ? editRequest.requestId
        : null;

    useKeyboardDelete({
        enabled: Boolean(selectedTask) && !deleteRequest && !deleteSubmitting,
        onDelete: () => {
            if (!selectedTask) return;
            requestDelete(
                selectedTask,
                findKeyboardDeleteAnchor('data-task-id', selectedTask.taskId) ?? document.body,
            );
        },
    });

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

    const handlePageClick = (event: React.MouseEvent<HTMLElement>) => {
        const target = event.target;
        if (target instanceof Element && (
            target.closest('[data-task-id]') || target.closest('[data-task-details]')
            || target.closest('[data-task-search]')
        )) {
            return;
        }
        setHighlightedTask(null);
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
                        maxWidth: 1180,
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
                        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(320px, 380px)' },
                        gap: { xs: 4, lg: 7 },
                        alignItems: 'start',
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <TaskPageComposer
                            onCreateTask={createTask}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                        />

                        <Box>
                            {(!isSearchActive || hasTodayTasks) && (
                                <TaskPageSection
                                    section="today"
                                    title="Today"
                                    tasks={visibleTodayTasks}
                                    groups={taskGroups}
                                    completedCount={visibleTodayTasks.filter(task => task.completed).length}
                                    expanded={isSearchActive || expandedSections.today}
                                    onToggle={toggleSection}
                                    onTaskClick={handleTaskSelect}
                                    selectedTaskId={selectedTask?.taskId}
                                    editRequestId={selectedEditRequestId}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    updateTask={updateTask}
                                    emptyMessage="No matching tasks scheduled for today"
                                    sectionRef={sectionRefs.today}
                                />
                            )}

                            {hasFutureTasks && (
                                <TaskPageSection
                                    section="comingUp"
                                    title="Coming up"
                                    tasks={futureTasksToShow}
                                    groups={taskGroups}
                                    completedCount={futureTasksToShow.filter(task => task.completed).length}
                                    expanded={isSearchActive || expandedSections.comingUp}
                                    onToggle={toggleSection}
                                    onTaskClick={handleTaskSelect}
                                    selectedTaskId={selectedTask?.taskId}
                                    editRequestId={selectedEditRequestId}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    updateTask={updateTask}
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
                                    groups={taskGroups}
                                    completedCount={visiblePastTasks.filter(task => task.completed).length}
                                    expanded={isSearchActive || expandedSections.leftovers}
                                    onToggle={toggleSection}
                                    onTaskClick={handleTaskSelect}
                                    selectedTaskId={selectedTask?.taskId}
                                    editRequestId={selectedEditRequestId}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    updateTask={updateTask}
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
                                    groups={taskGroups}
                                    completedCount={visibleUndatedTasks.filter(task => task.completed).length}
                                    expanded={isSearchActive || expandedSections.undated}
                                    onToggle={toggleSection}
                                    onTaskClick={handleTaskSelect}
                                    selectedTaskId={selectedTask?.taskId}
                                    editRequestId={selectedEditRequestId}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    updateTask={updateTask}
                                    emptyMessage="No matching undated tasks"
                                    sectionRef={sectionRefs.undated}
                                />
                            )}
                        </Box>

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
                            {deleteRequest.task.taskSeriesId
                                ? `Delete “${deleteRequest.task.name}” and all occurrences in its series?`
                                : `Delete “${deleteRequest.task.name}” and its subtasks?`}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                            <Button size="small" onClick={closeDeleteRequest} disabled={deleteSubmitting}>
                                Cancel
                            </Button>
                            <Button
                                size="small"
                                color="error"
                                variant="contained"
                                onClick={() => void confirmDelete()}
                                disabled={deleteSubmitting}
                            >
                                {deleteSubmitting ? 'Deleting…' : 'Delete'}
                            </Button>
                        </Box>
                    </Box>
                )}
            </Popover>
        </PageWrapper>
    );
}

export default TaskPage;
