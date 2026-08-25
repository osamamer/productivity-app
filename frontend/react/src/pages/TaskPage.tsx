import React, {useCallback, useMemo, useRef, useState} from 'react';
import { Box, Typography } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../contexts/TaskContext';
import { TaskToCreate } from '../types/TaskToCreate';
import { taskService } from '../services/api';
import { HighlightedTaskBox } from '../components/box/HighlightedTaskBox';
import { TaskPageComposer } from '../components/task-page/TaskPageComposer.tsx';
import { TaskPageSection } from '../components/task-page/TaskPageSection.tsx';
import { TaskPageOverview } from '../components/task-page/TaskPageOverview.tsx';
import { Task } from '../types/Task.tsx';

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
    } = useGlobalTasks();

    const [expandedSections, setExpandedSections] = useState<{
        today: boolean;
        comingUp: boolean;
        leftovers: boolean;
    }>({
        today: true,
        comingUp: false,
        leftovers: false,
    });
    const [activeExpansion, setActiveExpansion] = useState<{ taskId: string; panel: 'pomodoro' | 'details' } | null>(null);

    const todayRef = useRef<HTMLDivElement>(null);
    const comingUpRef = useRef<HTMLDivElement>(null);
    const leftoversRef = useRef<HTMLDivElement>(null);
    const allTasksRef = useRef(allTasks);
    const expandedSectionsRef = useRef(expandedSections);
    allTasksRef.current = allTasks;
    expandedSectionsRef.current = expandedSections;

    const createTask = useCallback(async (task: TaskToCreate) => {
        try {
            const createdTask = await taskService.createTask(task);
            addTaskToState(createdTask);
            setHighlightedTask(createdTask);
        } catch (err) {
            console.error('Error creating task:', err);
            await fetchAllTasks();
        }
    }, [addTaskToState, fetchAllTasks, setHighlightedTask]);

    const toggleTaskCompletion = useCallback(async (taskId: string) => {
        const task = allTasksRef.current.find(t => t.taskId === taskId);
        if (task) {
            updateTaskInState(taskId, { completed: !task.completed });
        }

        try {
            await taskService.toggleTaskCompletion(taskId, task ? !task.completed : undefined);
        } catch (err) {
            console.error('Error toggling task:', err);
            if (task) {
                updateTaskInState(taskId, { completed: task.completed });
            }
        }
    }, [updateTaskInState]);

    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
        const originalTask = allTasksRef.current.find(task => task.taskId === taskId);
        updateTaskInState(taskId, updates);

        try {
            await taskService.updateTask(taskId, updates);
        } catch (err) {
            console.error('Error updating task:', err);
            if (originalTask) {
                updateTaskInState(taskId, originalTask);
            }
            await fetchAllTasks();
        }
    }, [fetchAllTasks, updateTaskInState]);

    const changeDescription = useCallback(async (description: string, taskId: string) => {
        updateTaskInState(taskId, { description: description });

        try {
            await taskService.updateDescription(taskId, description);
        } catch (err) {
            console.error('Error updating description:', err);
            await fetchAllTasks();
        }
    }, [fetchAllTasks, updateTaskInState]);

    const handleChipClick = useCallback((section: 'today' | 'comingUp' | 'leftovers') => {
        const wasExpanded = expandedSectionsRef.current[section];
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section],
        }));

        // Scroll to the section
        const refs = {
            today: todayRef,
            comingUp: comingUpRef,
            leftovers: leftoversRef,
        };

        if (!wasExpanded) {
            setTimeout(() => {
                refs[section].current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end'
                });
            }, 100);
        }
    }, []);

    const todayTasksExist = Array.isArray(todayTasks) && todayTasks.length > 0;
    const futureTasksExist = Array.isArray(futureTasks) && futureTasks.length > 0;
    const pastTasksExist = Array.isArray(pastTasks) && pastTasks.length > 0;
    const tasksExist = todayTasksExist || futureTasksExist || pastTasksExist;

    const taskCounts = useMemo(() => {
        const counts = {
            completedToday: 0,
            completedFuture: 0,
            completedPast: 0,
            overduePending: 0,
            completed: 0,
            highPriorityPending: 0,
        };

        for (const task of todayTasks) {
            if (task.completed) counts.completedToday += 1;
        }
        for (const task of futureTasks) {
            if (task.completed) counts.completedFuture += 1;
        }
        for (const task of pastTasks) {
            if (task.completed) {
                counts.completedPast += 1;
            } else {
                counts.overduePending += 1;
            }
        }
        for (const task of allTasks) {
            if (task.completed) counts.completed += 1;
            if (!task.completed && task.importance > 7) counts.highPriorityPending += 1;
        }

        return counts;
    }, [allTasks, todayTasks, futureTasks, pastTasks]);

    const handleTogglePanel = useCallback((taskId: string, panel: 'pomodoro' | 'details') => {
        const selectedTask = allTasksRef.current.find(task => task.taskId === taskId) ?? null;
        setHighlightedTask(selectedTask);
        setActiveExpansion(prev => (
            prev?.taskId === taskId && prev.panel === panel ? null : { taskId, panel }
        ));
    }, [setHighlightedTask]);

    const handleAutoExpand = useCallback((taskId: string, panel: 'pomodoro') => {
        const selectedTask = allTasksRef.current.find(task => task.taskId === taskId) ?? null;
        setHighlightedTask(selectedTask);
        setActiveExpansion({ taskId, panel });
    }, [setHighlightedTask]);

    return (
        <PageWrapper>
            <Box sx={{
                display: 'flex',
                gap: { xs: 4, lg: 0 },
                height: '100%',
                flexWrap: 'wrap',
            }}>
                <Box sx={{
                    flex: { xs: '1 1 100%', lg: '1 1 60%' },
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    pr: { lg: 4 },
                }}>
                    <TaskPageComposer
                        todayCount={todayTasks.length}
                        upcomingCount={futureTasks.length}
                        pastCount={pastTasks.length}
                        expandedSections={expandedSections}
                        onCreateTask={createTask}
                        onToggleSection={handleChipClick}
                    />

                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                    }}>
                        <TaskPageSection
                            section="today"
                            title="Today"
                            tasks={todayTasks}
                            completedCount={taskCounts.completedToday}
                            expanded={expandedSections.today}
                            onToggle={handleChipClick}
                            onTaskClick={setHighlightedTask}
                            toggleTaskCompletion={toggleTaskCompletion}
                            updateTask={updateTask}
                            emptyMessage="No tasks scheduled for today"
                            sectionRef={todayRef}
                            activeExpansion={activeExpansion}
                            onTogglePanel={handleTogglePanel}
                            onAutoExpand={handleAutoExpand}
                        />
                        <TaskPageSection
                            section="comingUp"
                            title="Coming Up"
                            tasks={futureTasks}
                            completedCount={taskCounts.completedFuture}
                            expanded={expandedSections.comingUp}
                            onToggle={handleChipClick}
                            onTaskClick={setHighlightedTask}
                            toggleTaskCompletion={toggleTaskCompletion}
                            updateTask={updateTask}
                            emptyMessage="No upcoming tasks"
                            sectionRef={comingUpRef}
                            activeExpansion={activeExpansion}
                            onTogglePanel={handleTogglePanel}
                            onAutoExpand={handleAutoExpand}
                        />
                        <TaskPageSection
                            section="leftovers"
                            title="Leftovers"
                            tasks={pastTasks}
                            completedCount={taskCounts.completedPast}
                            expanded={expandedSections.leftovers}
                            onToggle={handleChipClick}
                            onTaskClick={setHighlightedTask}
                            toggleTaskCompletion={toggleTaskCompletion}
                            updateTask={updateTask}
                            emptyMessage="No overdue tasks"
                            sectionRef={leftoversRef}
                            activeExpansion={activeExpansion}
                            onTogglePanel={handleTogglePanel}
                            onAutoExpand={handleAutoExpand}
                        />
                    </Box>

                    {!tasksExist && (
                        <Typography
                            variant="h5"
                            sx={{
                                textAlign: 'left',
                                color: 'text.secondary',
                                fontStyle: 'italic',
                                py: 4,
                            }}
                        >
                            Nothing to do. Enjoy your free time!
                        </Typography>
                    )}
                </Box>

                <Box
                    sx={{
                        display: { xs: 'block', lg: 'flex' },
                        flex: { xs: '1 1 100%', lg: '0 0 auto' },
                        alignSelf: 'stretch',
                    }}
                >
                    <Box
                        sx={{
                            width: { xs: '100%', lg: '1px' },
                            height: { xs: '1px', lg: 'auto' },
                            backgroundColor: 'divider',
                            mb: { xs: 0, lg: 0 },
                        }}
                    />
                </Box>

                <Box sx={{
                    flex: { xs: '1 1 100%', lg: '1 1 35%' },
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    pl: { lg: 4 },
                }}>
                    {highlightedTask ? (
                        <HighlightedTaskBox
                            key={highlightedTask.taskId}
                            task={highlightedTask}
                            handleChangeDescription={changeDescription}
                            toggleTaskCompletion={toggleTaskCompletion}
                            />
                    ) : (
                        <Typography
                            variant="h6"
                            color="text.secondary"
                            sx={{
                                textAlign: 'left',
                                py: 4,
                                fontStyle: 'italic',
                            }}
                        >
                            Click on a task to view details
                        </Typography>
                    )}

                    <TaskPageOverview
                        totalCount={allTasks.length}
                        completedCount={taskCounts.completed}
                        pendingCount={allTasks.length - taskCounts.completed}
                        todayCount={todayTasks.length}
                        upcomingCount={futureTasks.length}
                        overdueCount={taskCounts.overduePending}
                        highPriorityCount={taskCounts.highPriorityPending}
                    />
                </Box>
            </Box>
        </PageWrapper>
    );
}

export default TaskPage;
