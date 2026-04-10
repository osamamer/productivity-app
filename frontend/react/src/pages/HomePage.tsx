import React, { useEffect } from 'react'
import { Box, Typography } from '@mui/material';
import { taskService } from "../services/api";
import { Task } from "../types/Task.tsx";
import { PageWrapper } from "../components/PageWrapper.tsx";
import { useGlobalTasks } from "../contexts/TaskContext.tsx";
import { useUser } from "../contexts/UserContext.tsx";
import { SmartTaskInput } from "../components/input/SmartTaskInput.tsx";
import { FlatTaskRow } from "../components/FlatTaskRow.tsx";
import { TaskToCreate } from "../types/TaskToCreate.tsx";

export function HomePage() {
    const { user } = useUser();

    const {
        allTasks,
        todayTasks,
        pastTasks,
        fetchAllTasks,
        fetchTodayTasks,
        fetchFutureTasks,
        fetchPastTasks,
        addTaskToState,
        updateTaskInState,
    } = useGlobalTasks();

    useEffect(() => {
        Promise.all([fetchAllTasks(), fetchTodayTasks(), fetchFutureTasks(), fetchPastTasks()]);
        // Fetch functions are stable context refs — intentional mount-only call.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function createTask(task: TaskToCreate) {
        try {
            const created = await taskService.createTask(task);
            addTaskToState(created);
        } catch (err) {
            console.error('Error creating task:', err);
            await Promise.all([fetchAllTasks(), fetchTodayTasks()]);
        }
    }

    async function updateTask(taskId: string, updates: Partial<Task>) {
        updateTaskInState(taskId, updates);
        try {
            await taskService.updateTask(taskId, updates);
        } catch (err) {
            console.error('Error updating task:', err);
            await fetchAllTasks();
        }
    }

    async function toggleTaskCompletion(taskId: string) {
        const task = allTasks.find(t => t.taskId === taskId);
        if (task) updateTaskInState(taskId, { completed: !task.completed });
        try {
            await taskService.toggleTaskCompletion(taskId);
        } catch (err) {
            console.error('Error toggling task:', err);
            if (task) updateTaskInState(taskId, { completed: task.completed });
        }
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user?.firstName || user?.username || '';
    const overdueCount = pastTasks.filter(t => !t.completed).length;
    const visibleTasks = todayTasks.filter(t => !t.parentId);

    return (
        <PageWrapper>
            <Box sx={{ maxWidth: 600, mx: 'auto', pt: 10, pb: 8, px: 2 }}>

                <Typography variant="h5" color="text.secondary" sx={{ mb: 4, fontWeight: 400 }}>
                    {greeting}{firstName ? `, ${firstName}` : ''}.
                </Typography>

                {/* Input — raised slightly off the page background */}
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

                {/* Today's tasks */}
                {visibleTasks.length > 0
                    ? visibleTasks.map(task => (
                        <FlatTaskRow
                            key={task.taskId}
                            task={task}
                            onToggle={toggleTaskCompletion}
                            onUpdate={updateTask}
                        />
                    ))
                    : (
                        <Typography variant="body1" color="text.secondary">
                            Nothing scheduled for today.
                        </Typography>
                    )
                }

                {/* Overdue — mentioned below today's list, not listed */}
                {overdueCount > 0 && (
                    <Typography
                        variant="body2"
                        sx={{ mt: 4, color: 'warning.main', fontWeight: 500 }}
                    >
                        {overdueCount} task{overdueCount > 1 ? 's' : ''} from earlier still waiting.
                    </Typography>
                )}

            </Box>
        </PageWrapper>
    );
}

export default HomePage
