import React from 'react';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Task } from '../../types/Task.tsx';
import { FlatTaskRow } from '../FlatTaskRow.tsx';

type SectionName = 'today' | 'comingUp' | 'leftovers';

const noopTogglePanel = () => undefined;
const noopAutoExpand = () => undefined;

type TaskPageSectionProps = {
    section: SectionName;
    title: string;
    tasks: Task[];
    completedCount: number;
    expanded: boolean;
    onToggle: (section: SectionName) => void;
    onTaskClick: (task: Task) => void;
    selectedTaskId?: string | null;
    toggleTaskCompletion: (taskId: string) => void;
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    emptyMessage: string;
    sectionRef?: React.RefObject<HTMLDivElement>;
    showScheduledDate?: boolean;
};

export const TaskPageSection = React.memo(function TaskPageSection({
    section,
    title,
    tasks,
    completedCount,
    expanded,
    onToggle,
    onTaskClick,
    selectedTaskId,
    toggleTaskCompletion,
    updateTask,
    emptyMessage,
    sectionRef,
    showScheduledDate = false,
}: TaskPageSectionProps) {
    const visibleTasks = tasks.filter(task => !task.parentId);

    return (
        <Box ref={sectionRef} sx={{ mb: 4 }}>
            <Box
                component="button"
                type="button"
                onClick={() => onToggle(section)}
                sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 0,
                    py: 0.75,
                    border: 0,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    background: 'none',
                    color: 'text.primary',
                    cursor: 'pointer',
                    textAlign: 'left',
                    '&:hover': { color: 'primary.main' },
                }}
            >
                <IconButton
                    component="span"
                    size="small"
                    tabIndex={-1}
                    aria-hidden="true"
                    sx={{ p: 0.25, color: 'inherit' }}
                >
                    {expanded
                        ? <ExpandMoreRoundedIcon fontSize="small" />
                        : <ChevronRightRoundedIcon fontSize="small" />}
                </IconButton>
                <Typography component="span" variant="h6" sx={{ fontWeight: 600 }}>
                    {title}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75 }}>
                    {visibleTasks.length}
                </Typography>
                {visibleTasks.length > 0 && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 'auto', mr: 1 }}>
                        {completedCount}/{visibleTasks.length} done
                    </Typography>
                )}
            </Box>

            <Collapse in={expanded} timeout={180} unmountOnExit>
                <Box sx={{ pt: 1 }}>
                    {visibleTasks.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            {visibleTasks.map(task => (
                                <FlatTaskRow
                                    key={task.taskId}
                                    task={task}
                                    onToggle={toggleTaskCompletion}
                                    onUpdate={updateTask}
                                    expandedPanel={null}
                                    onTogglePanel={noopTogglePanel}
                                    onAutoExpand={noopAutoExpand}
                                    onSelect={onTaskClick}
                                    selected={selectedTaskId === task.taskId}
                                    showScheduledDate={showScheduledDate}
                                    showPomodoroButton={false}
                                    showDetailsButton={false}
                                    deferPomodoroHydration
                                />
                            ))}
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1.5, pl: 4 }}>
                            {emptyMessage}
                        </Typography>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
});
