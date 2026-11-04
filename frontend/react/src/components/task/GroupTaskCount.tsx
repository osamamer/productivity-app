import { Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { Task } from '../../types/Task';

type GroupTaskCountProps = {
    tasks: Task[];
    sx?: SxProps<Theme>;
};

export function GroupTaskCount({ tasks, sx }: GroupTaskCountProps) {
    const remaining = tasks.filter(task => !task.completed).length;
    const partiallyComplete = remaining > 0 && remaining < tasks.length;

    return (
        <Typography
            component="span"
            variant="caption"
            color="text.disabled"
            aria-label={partiallyComplete ? `${remaining} of ${tasks.length} tasks remaining` : `${tasks.length} tasks`}
            sx={sx}
        >
            <span aria-hidden="true" style={{ textDecoration: partiallyComplete ? 'line-through' : 'none' }}>
                {tasks.length}
            </span>
            {partiallyComplete && (
                <span aria-hidden="true" style={{ display: 'inline-block', marginLeft: 7 }}>
                    {remaining}
                </span>
            )}
        </Typography>
    );
}
