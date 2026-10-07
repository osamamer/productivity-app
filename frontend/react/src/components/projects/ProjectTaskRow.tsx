import { memo, type MouseEvent } from 'react';
import { Box } from '@mui/material';
import { Task } from '../../types/Task';
import { TaskPageListRow } from '../task-page/TaskPageListRow';

interface ProjectTaskRowProps {
    task: Task;
    editRequestId: number | null;
    onToggle: (task: Task) => void;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
    onContextMenu: (task: Task, event: MouseEvent<HTMLElement>) => void;
}

export const ProjectTaskRow = memo(function ProjectTaskRow({
    task,
    editRequestId,
    onToggle,
    onUpdate,
    onContextMenu,
}: ProjectTaskRowProps) {
    return (
        <Box onContextMenu={event => onContextMenu(task, event)}>
            <TaskPageListRow
                task={task}
                editRequestId={editRequestId}
                onToggle={() => onToggle(task)}
                onUpdate={onUpdate}
                showScheduledDate
            />
        </Box>
    );
});
