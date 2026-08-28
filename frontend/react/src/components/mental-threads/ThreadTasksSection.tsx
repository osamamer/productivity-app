import { useState } from 'react';
import {
    Alert,
    Box,
    Checkbox,
    Stack,
    Typography,
    alpha,
} from '@mui/material';
import { Task } from '../../types/Task.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';
import { SmartTaskInput } from '../input/SmartTaskInput.tsx';

interface ThreadTasksSectionProps {
    tasks: Task[];
    canAddTasks: boolean;
    onCreate: (task: TaskToCreate) => Promise<void>;
    onToggle: (task: Task) => Promise<void>;
}

export function ThreadTasksSection({
    tasks,
    canAddTasks,
    onCreate,
    onToggle,
}: ThreadTasksSectionProps) {
    const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = (task: TaskToCreate) => {
        setError(null);
        void onCreate(task).catch(caughtError => {
            setError(caughtError instanceof Error ? caughtError.message : 'Could not create the task.');
        });
    };

    const handleToggle = async (task: Task) => {
        if (pendingTaskId) return;
        setPendingTaskId(task.taskId);
        setError(null);
        try {
            await onToggle(task);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Could not update the task.');
        } finally {
            setPendingTaskId(null);
        }
    };

    const completedCount = tasks.filter(task => task.completed).length;

    return (
        <Box sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
                <Typography variant="overline" color="text.secondary">Next actions</Typography>
                {tasks.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                        {completedCount}/{tasks.length} done
                    </Typography>
                )}
            </Stack>

            <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                {tasks.map(task => (
                    <Box
                        key={task.taskId}
                        sx={theme => ({
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 38,
                            borderRadius: 1.5,
                            px: 0.5,
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        })}
                    >
                        <Checkbox
                            size="small"
                            checked={task.completed}
                            disabled={pendingTaskId === task.taskId}
                            onChange={() => void handleToggle(task)}
                            inputProps={{ 'aria-label': `Mark ${task.name} ${task.completed ? 'incomplete' : 'complete'}` }}
                        />
                        <Typography
                            variant="body2"
                            sx={{
                                minWidth: 0,
                                overflowWrap: 'anywhere',
                                color: task.completed ? 'text.secondary' : 'text.primary',
                                textDecoration: task.completed ? 'line-through' : 'none',
                            }}
                        >
                            {task.name}
                        </Typography>
                    </Box>
                ))}
            </Stack>

            {canAddTasks && (
                <Box sx={theme => ({
                    mt: tasks.length > 0 ? 0.5 : 0,
                    pb: 0.5,
                    borderBottom: 1,
                    borderColor: alpha(theme.palette.text.primary, 0.14),
                    '& .MuiInput-underline:before, & .MuiInput-underline:after, & .MuiInput-underline:hover:not(.Mui-disabled):before': {
                        borderBottom: 'none',
                    },
                })}>
                    <SmartTaskInput onSubmit={handleCreate} placeholder="Add a next action…" />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </Box>
    );
}
