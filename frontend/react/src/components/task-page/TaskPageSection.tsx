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

type TaskPageRowProps = {
    task: Task;
    expandedPanel: 'pomodoro' | 'details' | null;
    onToggle: (taskId: string) => void;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
    onSelect: (task: Task) => void;
    onTogglePanel: (taskId: string, panel: 'pomodoro' | 'details') => void;
    onAutoExpand: (taskId: string, panel: 'pomodoro') => void;
};

const TaskPageRow = React.memo(function TaskPageRow({
    task,
    expandedPanel,
    onToggle,
    onUpdate,
    onSelect,
    onTogglePanel,
    onAutoExpand,
}: TaskPageRowProps) {
    const handleTogglePanel = React.useCallback((panel: 'pomodoro' | 'details') => {
        onTogglePanel(task.taskId, panel);
    }, [onTogglePanel, task.taskId]);

    const handleAutoExpand = React.useCallback((panel: 'pomodoro') => {
        onAutoExpand(task.taskId, panel);
    }, [onAutoExpand, task.taskId]);

    return (
        <FlatTaskRow
            task={task}
            onToggle={onToggle}
            onUpdate={onUpdate}
            expandedPanel={expandedPanel}
            onTogglePanel={handleTogglePanel}
            onAutoExpand={handleAutoExpand}
            onSelect={onSelect}
            showScheduledDate
            deferPomodoroHydration
        />
    );
});

const sectionIcons = {
    today: <TodayIcon color="primary" />,
    comingUp: <UpcomingIcon color="secondary" />,
    leftovers: <HistoryIcon />,
};

export const TaskPageSection = React.memo(function TaskPageSection({
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
                            <TaskPageRow
                                key={task.taskId}
                                task={task}
                                onToggle={toggleTaskCompletion}
                                onUpdate={updateTask}
                                expandedPanel={activeExpansion?.taskId === task.taskId ? activeExpansion.panel : null}
                                onTogglePanel={onTogglePanel}
                                onAutoExpand={onAutoExpand}
                                onSelect={onTaskClick}
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
});
