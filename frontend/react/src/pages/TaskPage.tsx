import React, {useEffect, useRef, useState} from 'react';
import { Box, Typography, Chip, Stack, Divider } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../contexts/TaskContext';
import { TaskToCreate } from '../types/TaskToCreate';
import { Task } from '../types/Task';
import { taskService } from '../services/api';
import { SmartTaskInput } from '../components/input/SmartTaskInput';
import { TaskAccordion } from '../components/TaskAccordion';
import { HoverCardBox } from '../components/box/HoverCardBox';
import { HighlightedTaskBox } from '../components/box/HighlightedTaskBox';
import TodayIcon from '@mui/icons-material/Today';
import UpcomingIcon from '@mui/icons-material/EventAvailable';
import HistoryIcon from '@mui/icons-material/History';

export function TaskPage() {
    const {
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        highlightedTask,
        loading,
        error,
        setHighlightedTask,
        fetchAllTasks,
        fetchTodayTasks,
        fetchFutureTasks,
        fetchPastTasks,
        addTaskToState,
        updateTaskInState,
        removeTaskFromState,
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

    const todayRef = useRef<HTMLDivElement>(null);
    const comingUpRef = useRef<HTMLDivElement>(null);
    const leftoversRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            await Promise.all([
                fetchAllTasks(),
                fetchTodayTasks(),
                fetchFutureTasks(),
                fetchPastTasks(),
            ]);
        };
        fetchData();
    }, []);

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

    async function completeTask(taskId: string) {
        removeTaskFromState(taskId);

        try {
            await taskService.completeTask(taskId);
        } catch (err) {
            console.error('Error completing task:', err);
            await fetchAllTasks();
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

    const handleClose = (dialogType: string) => {
        setDialogOpen((prev) => ({ ...prev, [dialogType]: false }));
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

    return (
        <PageWrapper>
            <Box sx={{
                display: 'flex',
                gap: 3,
                height: '100%',
                flexWrap: 'wrap',
            }}>
                {/* Main Task Management Section */}
                <Box sx={{
                    flex: { xs: '1 1 100%', lg: '1 1 60%' },
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                }}>
                    {/* Header Section */}
                    <HoverCardBox>
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                        }}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 2,
                            }}>
                                <Typography
                                    color="text.primary"
                                    variant="h4"
                                    component="h1"
                                    sx={{ fontWeight: 600 }}
                                >
                                    Tasks
                                </Typography>

                                <Stack direction="row" spacing={2}>
                                    <Chip
                                        icon={<TodayIcon />}
                                        label={`${todayTasks.length} Today`}
                                        color="primary"
                                        variant={expandedSections.today ? "filled" : "outlined"}
                                        onClick={() => handleChipClick('today')}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                    <Chip
                                        icon={<UpcomingIcon />}
                                        label={`${futureTasks.length} Upcoming`}
                                        color="secondary"
                                        variant={expandedSections.comingUp ? "filled" : "outlined"}
                                        onClick={() => handleChipClick('comingUp')}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                    <Chip
                                        icon={<HistoryIcon />}
                                        label={`${pastTasks.length} Past`}
                                        color="default"
                                        variant={expandedSections.leftovers ? "filled" : "outlined"}
                                        onClick={() => handleChipClick('leftovers')}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                </Stack>
                            </Box>

                            <Divider />

                            {/* Smart Task Input */}
                            <Box>
                                <Typography
                                    variant="h6"
                                    color="text.secondary"
                                    sx={{ mb: 2 }}
                                >
                                    What's on your mind?
                                </Typography>
                                <SmartTaskInput onSubmit={createTask} />
                            </Box>
                        </Box>
                    </HoverCardBox>

                    {/* Task Lists Section */}
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                    }}>
                        {/* Today's Tasks */}
                        <Box ref={todayRef}>
                            <HoverCardBox>
                                <Box sx={{ mb: 2 }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        mb: 1,
                                    }}>
                                        <Typography
                                            variant="h5"
                                            color="text.primary"
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
                                        >
                                            <TodayIcon color="primary" />
                                            Today
                                        </Typography>
                                        {todayTasksExist && (
                                            <Typography variant="body2" color="text.secondary">
                                                {completedTodayCount} of {todayTasks.length} completed
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                                <TaskAccordion
                                    title=""
                                    tasks={todayTasks}
                                    expanded={expandedSections.today}
                                    onChange={() => handleChipClick('today')}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    onTaskClick={setHighlightedTask}
                                />
                                {!todayTasksExist && (
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            textAlign: 'center',
                                            color: 'text.secondary',
                                            fontStyle: 'italic',
                                            py: 3,
                                        }}
                                    >
                                        No tasks scheduled for today
                                    </Typography>
                                )}
                            </HoverCardBox>
                        </Box>


                        {/* Coming Up Tasks */}
                        <Box ref={comingUpRef}>
                            <HoverCardBox>
                                <Box sx={{ mb: 2 }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        mb: 1,
                                    }}>
                                        <Typography
                                            variant="h5"
                                            color="text.primary"
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
                                        >
                                            <UpcomingIcon color="secondary" />
                                            Coming Up
                                        </Typography>
                                        {futureTasksExist && (
                                            <Typography variant="body2" color="text.secondary">
                                                {completedFutureCount} of {futureTasks.length} completed
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                                <TaskAccordion
                                    title=""
                                    tasks={futureTasks}
                                    expanded={expandedSections.comingUp}
                                    onChange={() => handleChipClick('comingUp')}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    onTaskClick={setHighlightedTask}
                                />
                                {!futureTasksExist && (
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            textAlign: 'center',
                                            color: 'text.secondary',
                                            fontStyle: 'italic',
                                            py: 3,
                                        }}
                                    >
                                        No upcoming tasks
                                    </Typography>
                                )}
                            </HoverCardBox>
                        </Box>


                        {/* Past Tasks (Leftovers) */}
                        <Box ref={leftoversRef}>
                            <HoverCardBox>
                                <Box sx={{ mb: 2 }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        mb: 1,
                                    }}>
                                        <Typography
                                            variant="h5"
                                            color="text.primary"
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
                                        >
                                            <HistoryIcon />
                                            Leftovers
                                        </Typography>
                                        {pastTasksExist && (
                                            <Typography variant="body2" color="text.secondary">
                                                {completedPastCount} of {pastTasks.length} completed
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                                <TaskAccordion
                                    title=""
                                    tasks={pastTasks}
                                    expanded={expandedSections.leftovers}
                                    onChange={() => handleChipClick('leftovers')}
                                    toggleTaskCompletion={toggleTaskCompletion}
                                    onTaskClick={setHighlightedTask}
                                />
                                {!pastTasksExist && (
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            textAlign: 'center',
                                            color: 'text.secondary',
                                            fontStyle: 'italic',
                                            py: 3,
                                        }}
                                    >
                                        No overdue tasks
                                    </Typography>
                                )}
                            </HoverCardBox>
                        </Box>

                    </Box>

                    {/* Empty State */}
                    {!tasksExist && (
                        <HoverCardBox>
                            <Typography
                                variant="h5"
                                sx={{
                                    textAlign: 'center',
                                    color: 'text.secondary',
                                    fontStyle: 'italic',
                                    py: 8,
                                }}
                            >
                                Nothing to do. Enjoy your free time! 🎉
                            </Typography>
                        </HoverCardBox>
                    )}
                </Box>

                {/* Highlighted Task Section */}
                <Box sx={{
                    flex: { xs: '1 1 100%', lg: '1 1 35%' },
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
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
                        <HoverCardBox>
                            <Typography
                                variant="h6"
                                color="text.secondary"
                                sx={{
                                    textAlign: 'center',
                                    py: 8,
                                    fontStyle: 'italic',
                                }}
                            >
                                Click on a task to view details
                            </Typography>
                        </HoverCardBox>
                    )}

                    {/* Task Statistics */}
                    <HoverCardBox>
                        <Typography
                            variant="h6"
                            color="text.primary"
                            sx={{ mb: 2 }}
                        >
                            Overview
                        </Typography>
                        <Stack spacing={2}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <Typography variant="body1" color="text.secondary">
                                    Total Tasks
                                </Typography>
                                <Typography variant="h6" color="text.primary">
                                    {allTasks.length}
                                </Typography>
                            </Box>
                            <Divider />
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <Typography variant="body1" color="text.secondary">
                                    Completed
                                </Typography>
                                <Typography variant="h6" color="success.main">
                                    {allTasks.filter(t => t.completed).length}
                                </Typography>
                            </Box>
                            <Divider />
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <Typography variant="body1" color="text.secondary">
                                    Pending
                                </Typography>
                                <Typography variant="h6" color="warning.main">
                                    {allTasks.filter(t => !t.completed).length}
                                </Typography>
                            </Box>
                        </Stack>
                    </HoverCardBox>
                </Box>
            </Box>
        </PageWrapper>
    );
}

export default TaskPage;