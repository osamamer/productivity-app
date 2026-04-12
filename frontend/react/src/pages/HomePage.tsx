import React, { useState } from 'react'
import { Box, Typography } from '@mui/material';
import { keyframes } from '@mui/system';
import { taskService } from "../services/api";
import { Task } from "../types/Task.tsx";
import { PageWrapper } from "../components/PageWrapper.tsx";
import { useGlobalTasks } from "../contexts/TaskContext.tsx";
import { useUser } from "../contexts/UserContext.tsx";
import { SmartTaskInput } from "../components/input/SmartTaskInput.tsx";
import { FlatTaskRow } from "../components/FlatTaskRow.tsx";
import { TaskToCreate } from "../types/TaskToCreate.tsx";
import { DayWidget } from "../components/DayWidget.tsx";

type ActiveExpansion = { taskId: string; panel: 'pomodoro' | 'details' } | null;

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

export function HomePage() {
    const { user } = useUser();
    const [activeExpansion, setActiveExpansion] = useState<ActiveExpansion>(null);

    const {
        allTasks,
        todayTasks,
        pastTasks,
        refreshTaskBuckets,
        addTaskToState,
        updateTaskInState,
    } = useGlobalTasks();

    async function createTask(task: TaskToCreate) {
        try {
            const created = await taskService.createTask(task);
            addTaskToState(created);
        } catch (err) {
            console.error('Error creating task:', err);
            await refreshTaskBuckets();
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
            await refreshTaskBuckets();
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

    function handleTogglePanel(taskId: string, panel: 'pomodoro' | 'details') {
        setActiveExpansion(prev =>
            prev?.taskId === taskId && prev?.panel === panel ? null : { taskId, panel }
        );
    }

    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'Good wee hours' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user?.firstName || user?.username || '';
    const overdueCount = pastTasks.filter(t => !t.completed).length;
    const visibleTasks = todayTasks.filter(t => !t.parentId);

    return (
        <PageWrapper>
            {/* Full-width relative wrapper so DayWidget can position against page edges */}
            <Box sx={{ position: 'relative', flex: 1 }}>
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
                            expandedPanel={activeExpansion?.taskId === task.taskId ? activeExpansion.panel : null}
                            onTogglePanel={(panel) => handleTogglePanel(task.taskId, panel)}
                            onAutoExpand={(panel) => setActiveExpansion({ taskId: task.taskId, panel })}
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

            <DayWidget />

            </Box>
        </PageWrapper>
    );
}

export default HomePage
