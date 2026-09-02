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
import { FlatTaskRow } from '../FlatTaskRow.tsx';
import { SmartTaskInput } from '../input/SmartTaskInput.tsx';

interface ThreadTasksSectionProps {
    tasks: Task[];
    canAddTasks: boolean;
    onCreate: (task: TaskToCreate) => Promise<void>;
    onToggle: (task: Task) => Promise<void>;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
}

export function ThreadTasksSection({
    tasks,
    canAddTasks,
    onCreate,
    onToggle,
    onUpdate,
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

    const handleToggleById = (taskId: string) => {
        const task = tasks.find(candidate => candidate.taskId === taskId);
        if (task) void handleToggle(task);
    };

    const handleUpdate = async (taskId: string, updates: Partial<Task>) => {
        setError(null);
        try {
            await onUpdate(taskId, updates);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Could not update the task.');
        }
    };

    const completedCount = tasks.filter(task => task.completed).length;
    const orderedTasks = [...tasks].sort((first, second) => first.displayOrder - second.displayOrder);

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
                {orderedTasks.map(task => (
                    <FlatTaskRow
                        key={task.taskId}
                        task={task}
                        onToggle={handleToggleById}
                        onUpdate={handleUpdate}
                        expandedPanel={null}
                        onTogglePanel={() => undefined}
                        onAutoExpand={() => undefined}
                        showPomodoroButton={false}
                        showDetailsButton={false}
                        deferPomodoroHydration
                    />
                ))}
            </Stack>

            {canAddTasks && (
                <Box sx={theme => ({
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 42,
                    mt: tasks.length > 0 ? 0.5 : 0,
                    borderRadius: 1.5,
                    px: 0.5,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                    '& .MuiInput-underline:before, & .MuiInput-underline:after, & .MuiInput-underline:hover:not(.Mui-disabled):before': {
                        borderBottom: 'none',
                    },
                    '& .MuiInputBase-input': {
                        py: 0.75,
                        fontSize: '1.05rem',
                        lineHeight: 1.5,
                    },
                    '& .MuiInputBase-input::placeholder': {
                        color: theme.palette.text.secondary,
                        opacity: 1,
                    },
                })}>
                    <Checkbox
                        size="small"
                        disabled
                        checked={false}
                        sx={{ mr: 0.5, color: 'text.disabled' }}
                        inputProps={{ 'aria-label': 'New next action' }}
                    />
                    <SmartTaskInput
                        onSubmit={handleCreate}
                        placeholder="Next Action..."
                        submitOnBlur
                    />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </Box>
    );
}
