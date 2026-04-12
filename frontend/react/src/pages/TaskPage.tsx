import React, {useRef, useState} from 'react';
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
        fetchTodayTasks,
        fetchFutureTasks,
        fetchPastTasks,
        addTaskToState,
        updateTaskInState,
    } = useGlobalTasks();

    const [dialogOpen, setDialogOpen] = useState<{ [key: string]: boolean }>({
        dayDialog: false,
        pomodoroDialog: false,
        createTaskDialog: false,
    });

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


    async function createTask(task: TaskToCreate) {
        try {
            const createdTask = await taskService.createTask(task);
            addTaskToState(createdTask);
            setHighlightedTask(createdTask);
        } catch (err) {
            console.error('Error creating task:', err);
            await Promise.all([
                fetchAllTasks(),
                fetchTodayTasks(),
                fetchFutureTasks(),
                fetchPastTasks(),
            ]);
        }
    }

    async function toggleTaskCompletion(taskId: string) {
        const task = allTasks.find(t => t.taskId === taskId);
        if (task) {
            updateTaskInState(taskId, { completed: !task.completed });
        }

        try {
            await taskService.toggleTaskCompletion(taskId);
        } catch (err) {
            console.error('Error toggling task:', err);
            if (task) {
                updateTaskInState(taskId, { completed: task.completed });
            }
        }
    }

    async function updateTask(taskId: string, updates: Partial<Task>) {
        const originalTask = allTasks.find(task => task.taskId === taskId);
        updateTaskInState(taskId, updates);

        try {
            await taskService.updateTask(taskId, updates);
        } catch (err) {
            console.error('Error updating task:', err);
            if (originalTask) {
                updateTaskInState(taskId, originalTask);
            }
            await Promise.all([
                fetchAllTasks(),
                fetchTodayTasks(),
                fetchFutureTasks(),
                fetchPastTasks(),
            ]);
        }
    }


    async function changeDescription(description: string, taskId: string) {
        updateTaskInState(taskId, { description: description });

        try {
            await taskService.updateDescription(taskId, description);
        } catch (err) {
            console.error('Error updating description:', err);
            await fetchAllTasks();
        }
    }

    const handleOpen = (dialogType: string) => {
        setDialogOpen((prev) => ({ ...prev, [dialogType]: true }));
    };

    const handleChipClick = (section: 'today' | 'comingUp' | 'leftovers') => {
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

        if (!expandedSections[section]) {
            setTimeout(() => {
                refs[section].current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end'
                });
            }, 100);
        }

    };

    const todayTasksExist = Array.isArray(todayTasks) && todayTasks.length > 0;
    const futureTasksExist = Array.isArray(futureTasks) && futureTasks.length > 0;
    const pastTasksExist = Array.isArray(pastTasks) && pastTasks.length > 0;
    const tasksExist = todayTasksExist || futureTasksExist || pastTasksExist;

    const completedTodayCount = todayTasks.filter(t => t.completed).length;
    const completedFutureCount = futureTasks.filter(t => t.completed).length;
    const completedPastCount = pastTasks.filter(t => t.completed).length;
    const overduePendingCount = pastTasks.filter(t => !t.completed).length;
    const highPriorityPendingCount = allTasks.filter(t => !t.completed && t.importance > 7).length;

    function handleTogglePanel(taskId: string, panel: 'pomodoro' | 'details') {
        const selectedTask = allTasks.find(task => task.taskId === taskId) ?? null;
        setHighlightedTask(selectedTask);
        setActiveExpansion(prev => (
            prev?.taskId === taskId && prev.panel === panel ? null : { taskId, panel }
        ));
    }

    function handleAutoExpand(taskId: string, panel: 'pomodoro') {
        const selectedTask = allTasks.find(task => task.taskId === taskId) ?? null;
        setHighlightedTask(selectedTask);
        setActiveExpansion({ taskId, panel });
    }

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
                            completedCount={completedTodayCount}
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
                            completedCount={completedFutureCount}
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
                            completedCount={completedPastCount}
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
                            tasks={allTasks}
                            task={highlightedTask}
                            handleOpenDialog={handleOpen}
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
                        completedCount={allTasks.filter(t => t.completed).length}
                        pendingCount={allTasks.filter(t => !t.completed).length}
                        todayCount={todayTasks.length}
                        upcomingCount={futureTasks.length}
                        overdueCount={overduePendingCount}
                        highPriorityCount={highPriorityPendingCount}
                    />
                </Box>
            </Box>
        </PageWrapper>
    );
}

export default TaskPage;
