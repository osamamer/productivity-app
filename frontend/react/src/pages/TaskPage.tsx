import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Button, Popover, Typography } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../hooks/useGlobalTasks';
import { TaskToCreate } from '../types/TaskToCreate';
import { taskService } from '../services/api';
import { TaskPageComposer } from '../components/task-page/TaskPageComposer';
import { TaskPageSection } from '../components/task-page/TaskPageSection';
import { TaskDetailsPanel } from '../components/task-page/TaskDetailsPanel';
import { Task } from '../types/Task';
import { getShowCompletedHomeTasks } from '../services/utils/homePreferences';

type SectionName = 'today' | 'comingUp' | 'leftovers';
type DeleteRequest = { task: Task; anchorEl: HTMLElement };

export function TaskPage() {
    const {
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        highlightedTask,
        setHighlightedTask,
        fetchAllTasks,
        addTaskToState,
        updateTaskInState,
        removeTaskFromState,
    } = useGlobalTasks();

    const [expandedSections, setExpandedSections] = useState<Record<SectionName, boolean>>({
        today: true,
        comingUp: true,
        leftovers: false,
    });
    const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const allTasksRef = useRef(allTasks);
    const todayRef = useRef<HTMLDivElement>(null);
    const comingUpRef = useRef<HTMLDivElement>(null);
    const leftoversRef = useRef<HTMLDivElement>(null);
    allTasksRef.current = allTasks;

    const createTask = useCallback(async (task: TaskToCreate) => {
        try {
            const createdTask = await taskService.createTask(task);
            addTaskToState(createdTask);
            setHighlightedTask(createdTask);
        } catch (error) {
            console.error('Error creating task:', error);
            await fetchAllTasks(true);
        }
    }, [addTaskToState, fetchAllTasks, setHighlightedTask]);

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
            await taskService.toggleTaskCompletion(taskId, task ? !task.completed : undefined);
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
            await fetchAllTasks(true);
        }
    }, [fetchAllTasks, updateTaskInState]);

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
            await fetchAllTasks(true);
        } finally {
            setDeleteSubmitting(false);
            setDeleteRequest(null);
        }
    }, [deleteRequest, deleteSubmitting, fetchAllTasks, highlightedTask, removeTaskFromState, setHighlightedTask]);

    const toggleSection = useCallback((section: SectionName) => {
        setExpandedSections(previous => ({ ...previous, [section]: !previous[section] }));
    }, []);

    const handleTaskSelect = useCallback((task: Task) => {
        setHighlightedTask(task);
    }, [setHighlightedTask]);

    const closeTaskDetails = useCallback(() => {
        setHighlightedTask(null);
    }, [setHighlightedTask]);

    const showCompletedTasks = getShowCompletedHomeTasks();
    const visibleTodayTasks = useMemo(
        () => todayTasks.filter(task => !task.parentId && (showCompletedTasks || !task.completed)),
        [showCompletedTasks, todayTasks],
    );
    const visibleFutureTasks = useMemo(
        () => futureTasks.filter(task => !task.parentId && (showCompletedTasks || !task.completed)),
        [futureTasks, showCompletedTasks],
    );
    const visiblePastTasks = useMemo(
        () => pastTasks.filter(task => !task.parentId && (showCompletedTasks || !task.completed)),
        [pastTasks, showCompletedTasks],
    );

    const hasTodayTasks = visibleTodayTasks.length > 0;
    const hasFutureTasks = visibleFutureTasks.length > 0;
    const hasPastTasks = visiblePastTasks.length > 0;
    const hasTasks = hasTodayTasks || hasFutureTasks || hasPastTasks;
    const selectedTask = highlightedTask && (showCompletedTasks || !highlightedTask.completed)
        ? highlightedTask
        : null;

    const sectionRefs: Record<SectionName, React.RefObject<HTMLDivElement>> = {
        today: todayRef,
        comingUp: comingUpRef,
        leftovers: leftoversRef,
    };

    const handlePageClick = (event: React.MouseEvent<HTMLElement>) => {
        const target = event.target;
        if (target instanceof Element && (
            target.closest('[data-task-id]') || target.closest('[data-task-details]')
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
                        <TaskPageComposer onCreateTask={createTask} />

                        <Box>
                            <TaskPageSection
                                section="today"
                                title="Today"
                                tasks={visibleTodayTasks}
                                completedCount={visibleTodayTasks.filter(task => task.completed).length}
                                expanded={expandedSections.today}
                                onToggle={toggleSection}
                                onTaskClick={handleTaskSelect}
                                selectedTaskId={selectedTask?.taskId}
                                toggleTaskCompletion={toggleTaskCompletion}
                                updateTask={updateTask}
                                emptyMessage="No tasks scheduled for today"
                                sectionRef={sectionRefs.today}
                            />

                            {hasFutureTasks && (
                                <TaskPageSection
                                    section="comingUp"
                                    title="Coming up"
                                    tasks={visibleFutureTasks}
                                    completedCount={visibleFutureTasks.filter(task => task.completed).length}
                                    expanded={expandedSections.comingUp}
                                    onToggle={toggleSection}
                                    onTaskClick={handleTaskSelect}
                                    selectedTaskId={selectedTask?.taskId}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    updateTask={updateTask}
                                    emptyMessage="No upcoming tasks"
                                    sectionRef={sectionRefs.comingUp}
                                    showScheduledDate
                                />
                            )}

                            {hasPastTasks && (
                                <TaskPageSection
                                    section="leftovers"
                                    title="Leftovers"
                                    tasks={visiblePastTasks}
                                    completedCount={visiblePastTasks.filter(task => task.completed).length}
                                    expanded={expandedSections.leftovers}
                                    onToggle={toggleSection}
                                    onTaskClick={handleTaskSelect}
                                    selectedTaskId={selectedTask?.taskId}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    updateTask={updateTask}
                                    emptyMessage="No older tasks"
                                    sectionRef={sectionRefs.leftovers}
                                    showScheduledDate
                                />
                            )}
                        </Box>

                        {!hasTasks && (
                            <Typography variant="body1" color="text.secondary" sx={{ py: 2 }}>
                                Nothing to do. Enjoy your free time!
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
                            Delete “{deleteRequest.task.name}” and its subtasks?
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
