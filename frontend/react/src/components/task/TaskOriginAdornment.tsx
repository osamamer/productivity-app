import { Box, Tooltip } from '@mui/material';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import type { Task } from '../../types/Task';
import type { TaskGroup } from '../../types/TaskGroup';

export type TaskOriginKind = 'thread' | 'stat';

export function getTaskOriginKind(task: Task, group?: TaskGroup): TaskOriginKind | null {
    if (group?.linkedToMentalThread || task.mentalThreadId) return 'thread';
    if (group?.isStatGroup || task.linkedStatDefinitionId || task.statLinked) return 'stat';
    return null;
}

export function TaskOriginAdornment({ kind }: { kind: TaskOriginKind | null | undefined }) {
    if (!kind) return null;

    const Icon = kind === 'thread' ? PsychologyOutlinedIcon : QueryStatsOutlinedIcon;
    const label = kind === 'thread' ? 'Mental thread task' : 'Statistic task';

    return (
        <Tooltip title={label}>
            <Box
                component="span"
                role="img"
                aria-label={label}
                onClick={event => event.stopPropagation()}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    ml: 0.5,
                    verticalAlign: 'text-bottom',
                    color: 'text.secondary',
                    opacity: 0.72,
                    cursor: 'default',
                }}
            >
                <Icon sx={{ fontSize: 15 }} />
            </Box>
        </Tooltip>
    );
}
