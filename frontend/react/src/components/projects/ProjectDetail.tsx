import { useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    LinearProgress,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Project } from '../../types/Project';
import { Task } from '../../types/Task';
import { ProjectTaskRow } from './ProjectTaskRow';
import { projectProgressPercent } from './projectsPresentation';

interface ProjectDetailProps {
    project: Project;
    tasks: Task[];
    tasksLoading: boolean;
    pendingUnassignIds: ReadonlySet<string>;
    onEdit: () => void;
    onAddTask: (name: string) => Promise<boolean>;
    onToggleTask: (task: Task) => void;
    onUnassignTask: (task: Task) => void;
}

export function ProjectDetail({
    project,
    tasks,
    tasksLoading,
    pendingUnassignIds,
    onEdit,
    onAddTask,
    onToggleTask,
    onUnassignTask,
}: ProjectDetailProps) {
    const [draft, setDraft] = useState('');

    const submitDraft = async () => {
        const name = draft.trim();
        if (!name) return;
        setDraft('');
        const created = await onAddTask(name);
        if (!created) setDraft(current => current || name);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={700}>{project.name}</Typography>
                        {project.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                {project.description}
                            </Typography>
                        )}
                    </Box>
                    <Button
                        size="small"
                        startIcon={<EditRoundedIcon />}
                        onClick={onEdit}
                        sx={{ flexShrink: 0, color: 'text.secondary' }}
                    >
                        Edit
                    </Button>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
                    <LinearProgress
                        variant="determinate"
                        value={projectProgressPercent(project)}
                        aria-label={`${project.completedTaskCount} of ${project.taskCount} tasks completed`}
                        sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover' }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {project.completedTaskCount} of {project.taskCount} tasks completed
                    </Typography>
                </Stack>
            </Box>

            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                <TextField
                    fullWidth
                    variant="standard"
                    placeholder="Add a task to this project"
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void submitDraft();
                        }
                    }}
                    inputProps={{ maxLength: 200, 'aria-label': 'New task name' }}
                    InputProps={{ disableUnderline: true, sx: { px: 1, fontSize: '1.05rem' } }}
                />
                <IconButton
                    size="small"
                    aria-label="Add task"
                    disabled={!draft.trim()}
                    onClick={() => void submitDraft()}
                >
                    <AddRoundedIcon fontSize="small" />
                </IconButton>
            </Stack>

            {tasksLoading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', p: 4 }}>
                    <CircularProgress size={28} aria-label="Loading project tasks" />
                </Box>
            ) : tasks.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        No tasks yet. Add the first one above.
                    </Typography>
                </Box>
            ) : (
                <Box>
                    {tasks.map(task => (
                        <ProjectTaskRow
                            key={task.taskId}
                            task={task}
                            unassigning={pendingUnassignIds.has(task.taskId)}
                            onToggle={onToggleTask}
                            onUnassign={onUnassignTask}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
}
