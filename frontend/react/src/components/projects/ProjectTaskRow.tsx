import { memo } from 'react';
import { Box, Checkbox, IconButton, Stack, Typography } from '@mui/material';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import { Task } from '../../types/Task';
import { formatScheduledDate } from './projectsPresentation';

interface ProjectTaskRowProps {
    task: Task;
    unassigning: boolean;
    onToggle: (task: Task) => void;
    onUnassign: (task: Task) => void;
}

export const ProjectTaskRow = memo(function ProjectTaskRow({
    task,
    unassigning,
    onToggle,
    onUnassign,
}: ProjectTaskRowProps) {
    return (
        <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{
                px: 1,
                py: 0.5,
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
            }}
        >
            <Checkbox
                size="small"
                checked={task.completed}
                onChange={() => onToggle(task)}
                inputProps={{ 'aria-label': `Mark ${task.name} as ${task.completed ? 'not completed' : 'completed'}` }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    variant="body2"
                    noWrap
                    sx={{
                        textDecoration: task.completed ? 'line-through' : 'none',
                        color: task.completed ? 'text.secondary' : 'text.primary',
                    }}
                >
                    {task.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {formatScheduledDate(task.scheduledPerformDateTime)}
                </Typography>
            </Box>
            <IconButton
                size="small"
                title="Remove from this project"
                aria-label={`Remove ${task.name} from this project`}
                disabled={unassigning}
                onClick={() => onUnassign(task)}
                sx={{ color: 'text.secondary' }}
            >
                <LinkOffRoundedIcon fontSize="small" />
            </IconButton>
        </Stack>
    );
});
