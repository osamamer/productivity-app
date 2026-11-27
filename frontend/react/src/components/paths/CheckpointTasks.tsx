import { Box, Checkbox, TextField, Typography } from '@mui/material';
import { useState, type KeyboardEvent } from 'react';
import { taskService } from '../../services/api/taskService';
import type { Task } from '../../types/Task';

interface Props {
    checkpointId: string;
    tasks: Task[];
    onChanged: () => void;
}

/** The tasks under one checkpoint: tick them off or add another. */
export function CheckpointTasks({ checkpointId, tasks, onChanged }: Props) {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const add = async (event: KeyboardEvent) => {
        if (event.key !== 'Enter' || !name.trim()) return;
        event.preventDefault();
        try {
            // Unscheduled: a project task waits until the user picks a day.
            await taskService.createTask({ name: name.trim(), description: '', scheduledPerformDateTime: '', tag: '', importance: 5, checkpointId });
            setName('');
            onChanged();
        } catch (createError) {
            console.error('Could not add the task:', createError);
            setError('Could not add the task.');
        }
    };

    const toggle = async (task: Task) => {
        try {
            await taskService.toggleTaskCompletion(task.taskId, !task.completed);
            onChanged();
        } catch (toggleError) {
            console.error('Could not update the task:', toggleError);
            setError('Could not update the task.');
        }
    };

    return (
        <Box sx={{ pl: 1 }}>
            {tasks.map(task => (
                <Box key={task.taskId} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox size="small" checked={task.completed} onChange={() => toggle(task)} inputProps={{ 'aria-label': `Done: ${task.name}` }} />
                    <Typography variant="body2" sx={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'text.secondary' : 'text.primary' }}>
                        {task.name}
                    </Typography>
                </Box>
            ))}
            <TextField size="small" variant="standard" fullWidth placeholder="Add a task" value={name}
                       inputProps={{ 'aria-label': 'Add a task to this checkpoint' }}
                       onChange={event => setName(event.target.value)} onKeyDown={add} sx={{ mt: 0.5, mb: 1 }} />
            {error && <Typography variant="caption" color="error">{error}</Typography>}
        </Box>
    );
}
