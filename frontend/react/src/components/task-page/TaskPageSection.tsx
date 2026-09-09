import React, { useMemo, useState } from 'react';
import { Box, Button, Collapse, IconButton, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Task } from '../../types/Task.tsx';
import { TaskGroup } from '../../types/TaskGroup';
import { FlatTaskRow } from '../FlatTaskRow.tsx';

type SectionName = 'today' | 'comingUp' | 'leftovers' | 'undated';

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
    editRequestId?: number | null;
    toggleTaskCompletion: (taskId: string) => void;
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    emptyMessage: string;
    groups?: TaskGroup[];
    sectionRef?: React.RefObject<HTMLDivElement>;
    showScheduledDate?: boolean;
    showMore?: {
        count: number;
        label: string;
        loading?: boolean;
        onClick: () => void;
    };
};

type TaskListItem =
    | { kind: 'task'; task: Task }
    | { kind: 'group'; group: TaskGroup; tasks: Task[] };

function buildTaskListItems(tasks: Task[], groups: TaskGroup[]): TaskListItem[] {
    const visibleTaskIds = new Set(tasks.map(task => task.taskId));
    const groupByTaskId = new Map<string, TaskGroup>();
    [...groups]
        .filter(group => group.taskIds.length >= 2)
        .sort((first, second) => first.displayOrder - second.displayOrder)
        .forEach(group => group.taskIds.forEach(taskId => {
            if (visibleTaskIds.has(taskId) && !groupByTaskId.has(taskId)) groupByTaskId.set(taskId, group);
        }));

    const emittedGroupIds = new Set<string>();
    return tasks.reduce<TaskListItem[]>((items, task) => {
        const group = groupByTaskId.get(task.taskId);
        if (!group) {
            items.push({ kind: 'task', task });
        } else if (!emittedGroupIds.has(group.groupId)) {
            emittedGroupIds.add(group.groupId);
            items.push({
                kind: 'group',
                group,
                tasks: tasks.filter(candidate => groupByTaskId.get(candidate.taskId)?.groupId === group.groupId),
            });
        }
        return items;
    }, []);
}

export const TaskPageSection = React.memo(function TaskPageSection({
    section,
    title,
    tasks,
    completedCount,
    expanded,
    onToggle,
    onTaskClick,
    selectedTaskId,
    editRequestId = null,
    toggleTaskCompletion,
    updateTask,
    emptyMessage,
    groups = [],
    sectionRef,
    showScheduledDate = false,
    showMore,
}: TaskPageSectionProps) {
    const visibleTasks = tasks.filter(task => !task.parentId);
    const listItems = useMemo(() => buildTaskListItems(visibleTasks, groups), [groups, visibleTasks]);
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
    const showMoreButton = showMore ? (
        <Button
            size="small"
            variant="text"
            onClick={event => {
                event.stopPropagation();
                showMore.onClick();
            }}
            disabled={showMore.loading}
            sx={{ alignSelf: 'flex-start', mt: 1, ml: 3.5 }}
        >
            {showMore.loading ? 'Loading…' : showMore.label}
        </Button>
    ) : null;

    const toggleGroup = (groupId: string) => {
        setCollapsedGroupIds(previous => {
            const next = new Set(previous);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const renderTask = (task: Task) => (
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
            editRequestId={selectedTaskId === task.taskId ? editRequestId : null}
            showScheduledDate={showScheduledDate}
            showPomodoroButton={false}
            showDetailsButton={false}
            deferPomodoroHydration
        />
    );

    const renderListItem = (item: TaskListItem) => {
        if (item.kind === 'task') return renderTask(item.task);

        const collapsed = collapsedGroupIds.has(item.group.groupId);
        return (
            <Box
                key={item.group.groupId}
                data-task-group-id={item.group.groupId}
                sx={{ mb: 0.4 }}
            >
                <Box
                    component="button"
                    type="button"
                    data-task-group-header="true"
                    onClick={() => toggleGroup(item.group.groupId)}
                    aria-expanded={!collapsed}
                    sx={{
                        position: 'relative',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: 52,
                        borderRadius: 1.5,
                        px: 0.5,
                        border: 0,
                        color: 'text.secondary',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'opacity 0.16s, transform 0.16s, background-color 0.18s',
                        '&:hover': { backgroundColor: 'action.hover' },
                    }}
                >
                    <IconButton component="span" size="small" tabIndex={-1} aria-hidden="true" sx={{ width: 38, height: 38, p: 0, mr: 0.5, flexShrink: 0, color: 'inherit' }}>
                        {collapsed
                            ? <ChevronRightRoundedIcon fontSize="small" />
                            : <ExpandMoreRoundedIcon fontSize="small" />}
                    </IconButton>
                    <Typography component="span" variant="body2" sx={{ fontWeight: 650, flex: 1, minWidth: 0 }}>
                        {item.group.name}
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                            {item.tasks.length}
                        </Typography>
                    </Typography>
                </Box>
                <Collapse in={!collapsed} timeout={210} unmountOnExit sx={{ willChange: 'height', '& .MuiCollapse-wrapper': { willChange: 'height' } }}>
                    <Box
                        data-task-group-content={item.group.groupId}
                        sx={{
                            ml: 1.7,
                            pl: 1.1,
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            backgroundColor: 'transparent',
                            transition: 'background-color 0.18s',
                        }}
                    >
                        {item.tasks.map(renderTask)}
                    </Box>
                </Collapse>
            </Box>
        );
    };

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
                            {listItems.map(renderListItem)}
                            {showMoreButton}
                        </Box>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ py: 1.5, pl: 4 }}>
                                {emptyMessage}
                            </Typography>
                            {showMoreButton}
                        </>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
});
