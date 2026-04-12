import React from 'react';
import { Box, Typography } from '@mui/material';
import TodayIcon from '@mui/icons-material/Today';
import UpcomingIcon from '@mui/icons-material/EventAvailable';
import HistoryIcon from '@mui/icons-material/History';
import { Task } from '../../types/Task.tsx';
import { FlatTaskRow } from '../FlatTaskRow.tsx';
import { TaskAccordion } from '../TaskAccordion.tsx';

type SectionName = 'today' | 'comingUp' | 'leftovers';

type TaskPageSectionProps = {
    section: SectionName;
    title: string;
    tasks: Task[];
    completedCount: number;
    expanded: boolean;
    onToggle: (section: SectionName) => void;
    onTaskClick: (task: Task) => void;
    toggleTaskCompletion: (taskId: string) => void;
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    emptyMessage: string;
    sectionRef?: React.RefObject<HTMLDivElement>;
    activeExpansion: { taskId: string; panel: 'pomodoro' | 'details' } | null;
    onTogglePanel: (taskId: string, panel: 'pomodoro' | 'details') => void;
    onAutoExpand: (taskId: string, panel: 'pomodoro') => void;
};

const sectionIcons = {
    today: <TodayIcon color="primary" />,
    comingUp: <UpcomingIcon color="secondary" />,
    leftovers: <HistoryIcon />,
};

export function TaskPageSection({
    section,
    title,
    tasks,
    completedCount,
    expanded,
    onToggle,
    onTaskClick,
    toggleTaskCompletion,
    updateTask,
    emptyMessage,
    sectionRef,
    activeExpansion,
    onTogglePanel,
    onAutoExpand,
}: TaskPageSectionProps) {
    const tasksExist = tasks.length > 0;

    return (
        <Box
            ref={sectionRef}
            sx={{
                pb: 2.5,
                borderBottom: theme => `1px solid ${theme.palette.divider}`,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                }}
            >
                <Typography
                    variant="h5"
                    color="text.primary"
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                    }}
                >
                    {sectionIcons[section]}
                    {title}
                </Typography>
                {tasksExist && (
                    <Typography variant="body2" color="text.secondary">
                        {completedCount} of {tasks.length} completed
                    </Typography>
                )}
            </Box>

            <TaskAccordion
                title=""
                tasks={tasks}
                expanded={expanded}
                onChange={() => onToggle(section)}
                toggleTaskCompletion={toggleTaskCompletion}
                onTaskClick={onTaskClick}
                summarySx={{ px: 0, minHeight: 32, '& .MuiAccordionSummary-content': { my: 0 } }}
                detailsSx={{ px: 0 }}
                listSx={{ py: 0 }}
                accordionSx={{ mb: 0, '&.Mui-expanded': { margin: 0 } }}
                renderTasks={(visibleTasks) => (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, }}>
                        {visibleTasks.map(task => (
                            <FlatTaskRow
                                key={task.taskId}
                                task={task}
                                onToggle={toggleTaskCompletion}
                                onUpdate={updateTask}
                                expandedPanel={activeExpansion?.taskId === task.taskId ? activeExpansion.panel : null}
                            onTogglePanel={(panel) => onTogglePanel(task.taskId, panel)}
                            onAutoExpand={(panel) => onAutoExpand(task.taskId, panel)}
                            onSelect={onTaskClick}
                            showScheduledDate
                            deferPomodoroHydration
                        />
                    ))}
                </Box>
                )}
            />

            {!tasksExist && (
                <Typography
                    variant="body1"
                    sx={{
                        textAlign: 'left',
                        color: 'text.secondary',
                        fontStyle: 'italic',
                        py: 2,
                    }}
                >
                    {emptyMessage}
                </Typography>
            )}
        </Box>
    );
}
