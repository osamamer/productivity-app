import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { alpha } from '@mui/material/styles';
import { Box, Button, Collapse, Fade, IconButton, TextField, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AdsClickRoundedIcon from '@mui/icons-material/AdsClickRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { Task } from '../../types/Task.tsx';
import { TaskGroup } from '../../types/TaskGroup';
import { TaskToCreate } from '../../types/TaskToCreate';
import { TaskPageListRow } from './TaskPageListRow';
import { GroupTaskInputRow } from '../task/GroupTaskInputRow';
import { buildTaskListItems, type TaskListItem } from './taskPageSectionUtils';

type SectionName = 'today' | 'comingUp' | 'leftovers' | 'undated';

type TaskPageSectionProps = {
    section: SectionName;
    title: string;
    tasks: Task[];
    completedCount: number;
    expanded: boolean;
    onToggle: (section: SectionName) => void;
    onTaskClick: (task: Task) => void;
    onTaskSelection?: (task: Task, event: React.MouseEvent<HTMLElement>) => void;
    selectedTaskId?: string | null;
    selectedTaskIds?: ReadonlySet<string>;
    selectedGroupTaskIds?: ReadonlySet<string>;
    selectedGroupIds?: ReadonlySet<string>;
    onGroupSelection?: (group: TaskGroup, event: React.MouseEvent<HTMLElement>) => void;
    onRenameGroup?: (group: TaskGroup, name: string) => Promise<void>;
    onCreateTaskInGroup?: (group: TaskGroup, task: TaskToCreate) => void;
    onDeleteGroup?: (group: TaskGroup, anchorEl: HTMLElement) => void;
    onGroupDragOver?: (group: TaskGroup, event: React.DragEvent<HTMLElement>) => void;
    onGroupDrop?: (group: TaskGroup, event: React.DragEvent<HTMLElement>) => void;
    dragTargetGroupId?: string | null;
    onTaskDragStart?: (task: Task) => void;
    onTaskDragEnd?: () => void;
    draggedTaskIds?: ReadonlySet<string>;
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

export const TaskPageSection = React.memo(function TaskPageSection({
    section,
    title,
    tasks,
    completedCount,
    expanded,
    onToggle,
    onTaskClick,
    onTaskSelection,
    selectedTaskId,
    selectedTaskIds,
    selectedGroupTaskIds,
    selectedGroupIds,
    onGroupSelection,
    onRenameGroup,
    onCreateTaskInGroup,
    onDeleteGroup,
    onGroupDragOver,
    onGroupDrop,
    dragTargetGroupId,
    onTaskDragStart,
    onTaskDragEnd,
    draggedTaskIds,
    editRequestId = null,
    toggleTaskCompletion,
    updateTask,
    emptyMessage,
    groups = [],
    sectionRef,
    showScheduledDate = false,
    showMore,
}: TaskPageSectionProps) {
    const visibleTasks = useMemo(() => tasks.filter(task => !task.parentId), [tasks]);
    const listItems = useMemo(() => buildTaskListItems(visibleTasks, groups), [groups, visibleTasks]);
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
    const [contentMounted, setContentMounted] = useState(expanded);
    const [animatedExpanded, setAnimatedExpanded] = useState(expanded);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [localGroupName, setLocalGroupName] = useState('');
    const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
    const [groupTaskInputGeneration, setGroupTaskInputGeneration] = useState(0);
    const groupNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
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

    useLayoutEffect(() => {
        if (!expanded) {
            setAnimatedExpanded(false);
            return;
        }

        setContentMounted(true);
        const frameId = window.requestAnimationFrame(() => setAnimatedExpanded(true));
        return () => window.cancelAnimationFrame(frameId);
    }, [expanded]);

    useEffect(() => {
        if (!editingGroupId || !groupNameInputRef.current) return;

        const input = groupNameInputRef.current;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, [editingGroupId]);

    const startGroupNameEditing = (group: TaskGroup, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        if (!onRenameGroup) return;
        setEditingGroupId(group.groupId);
        setLocalGroupName(group.name);
    };

    const commitGroupName = async (group: TaskGroup) => {
        const trimmedName = localGroupName.trim();
        setEditingGroupId(null);
        setLocalGroupName(trimmedName || group.name);
        if (!onRenameGroup || !trimmedName || trimmedName === group.name) return;
        await onRenameGroup(group, trimmedName);
    };

    const cancelGroupNameEditing = (group: TaskGroup) => {
        setLocalGroupName(group.name);
        setEditingGroupId(null);
    };

    const renderTask = (task: Task) => (
        <Box key={task.taskId} sx={{ contentVisibility: 'auto', containIntrinsicSize: '52px' }}>
            <TaskPageListRow
                task={task}
                onToggle={toggleTaskCompletion}
                onUpdate={updateTask}
                onSelect={onTaskSelection ? undefined : onTaskClick}
                onSelectionClick={onTaskSelection}
                selected={selectedTaskIds?.has(task.taskId)
                    || selectedGroupTaskIds?.has(task.taskId)
                    || selectedTaskId === task.taskId}
                editRequestId={selectedTaskId === task.taskId ? editRequestId : null}
                showScheduledDate={showScheduledDate}
                draggable={Boolean(onTaskDragStart)}
                onDragStart={onTaskDragStart}
                onDragEnd={onTaskDragEnd}
                isDragging={draggedTaskIds?.has(task.taskId)}
            />
        </Box>
    );

    const renderListItem = (item: TaskListItem) => {
        if (item.kind === 'task') return renderTask(item.task);

        const collapsed = collapsedGroupIds.has(item.group.groupId);
        const selected = selectedGroupIds?.has(item.group.groupId) ?? false;
        const dragTarget = dragTargetGroupId === item.group.groupId;
        return (
            <Box
                key={item.group.groupId}
                data-task-group-id={item.group.groupId}
                onDragOver={event => onGroupDragOver?.(item.group, event)}
                onDrop={event => onGroupDrop?.(item.group, event)}
                sx={{
                    mb: 0.4,
                    borderRadius: 1.5,
                    backgroundColor: dragTarget
                        ? theme => alpha(theme.palette.primary.main, 0.045)
                        : 'transparent',
                }}
            >
                <Box
                    data-task-group-header="true"
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
                        backgroundColor: selected ? theme => alpha(theme.palette.primary.main, 0.09) : 'transparent',
                        textAlign: 'left',
                        transition: 'opacity 0.16s, transform 0.16s, background-color 0.18s',
                        '&:hover': { backgroundColor: 'action.hover' },
                    }}
                >
                    <IconButton
                        size="small"
                        aria-label={collapsed ? `Expand ${item.group.name}` : `Collapse ${item.group.name}`}
                        onClick={event => {
                            event.stopPropagation();
                            toggleGroup(item.group.groupId);
                        }}
                        sx={{ width: 38, height: 38, p: 0, mr: 0.5, flexShrink: 0, color: 'inherit' }}
                    >
                        {collapsed
                            ? <ChevronRightRoundedIcon fontSize="small" />
                            : <ExpandMoreRoundedIcon fontSize="small" />}
                    </IconButton>
                    {editingGroupId === item.group.groupId ? (
                        <TextField
                            value={localGroupName}
                            inputRef={groupNameInputRef}
                            autoComplete="off"
                            onClick={event => event.stopPropagation()}
                            onChange={event => setLocalGroupName(event.target.value)}
                            onBlur={() => void commitGroupName(item.group)}
                            onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void commitGroupName(item.group);
                                }
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelGroupNameEditing(item.group);
                                }
                            }}
                            variant="standard"
                            autoFocus
                            fullWidth
                            InputProps={{ disableUnderline: true }}
                            inputProps={{ draggable: false, 'data-task-group-name-input': 'true' }}
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                '& .MuiInputBase-input': {
                                    fontSize: '0.95rem',
                                    fontWeight: 650,
                                    lineHeight: 1.5,
                                    padding: 0,
                                },
                            }}
                        />
                    ) : (
                        <Box
                            component="button"
                            type="button"
                            aria-expanded={!collapsed}
                            onClick={event => {
                                if (event.shiftKey || event.ctrlKey || event.metaKey) {
                                    onGroupSelection?.(item.group, event);
                                    return;
                                }
                                startGroupNameEditing(item.group, event);
                            }}
                            onDoubleClick={event => startGroupNameEditing(item.group, event)}
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                border: 0,
                                padding: 0,
                                background: 'transparent',
                                color: 'inherit',
                                textAlign: 'left',
                                cursor: onRenameGroup ? 'text' : 'default',
                            }}
                        >
                            <Typography component="span" variant="body2" sx={{ fontWeight: 650 }}>
                                {item.group.name}
                                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                                    {item.tasks.length}
                                </Typography>
                            </Typography>
                        </Box>
                    )}
                    {onGroupSelection && (
                        <IconButton
                            size="small"
                            color={selected ? 'primary' : 'inherit'}
                            aria-label={selected
                                ? `Deselect group ${item.group.name}`
                                : `Select group ${item.group.name}`}
                            title={selected ? 'Deselect group' : 'Select group'}
                            onClick={event => onGroupSelection(item.group, event)}
                        >
                            <AdsClickRoundedIcon fontSize="small" />
                        </IconButton>
                    )}
                    {onCreateTaskInGroup && (
                        <IconButton
                            size="small"
                            color="inherit"
                            aria-label={`Add task to ${item.group.name}`}
                            title="Add task to group"
                            onClick={event => {
                                event.stopPropagation();
                                setAddingGroupId(item.group.groupId);
                                setGroupTaskInputGeneration(previous => previous + 1);
                                setCollapsedGroupIds(previous => {
                                    if (!previous.has(item.group.groupId)) return previous;

                                    const next = new Set(previous);
                                    next.delete(item.group.groupId);
                                    return next;
                                });
                            }}
                            disabled={addingGroupId === item.group.groupId}
                        >
                            <AddRoundedIcon fontSize="small" />
                        </IconButton>
                    )}
                    {onDeleteGroup && (
                        <IconButton
                            size="small"
                            color="error"
                            aria-label={`Delete group ${item.group.name}`}
                            title="Delete group"
                            onClick={event => {
                                event.stopPropagation();
                                onDeleteGroup(item.group, event.currentTarget);
                            }}
                        >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: '1.1rem' }} />
                        </IconButton>
                    )}
                </Box>
                <Collapse in={!collapsed} timeout={210}>
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
                        <Collapse
                            in={addingGroupId === item.group.groupId}
                            timeout={180}
                            unmountOnExit
                            sx={{
                                willChange: 'height',
                                '& .MuiCollapse-wrapper': { willChange: 'height' },
                            }}
                        >
                            <Fade in={addingGroupId === item.group.groupId} timeout={150}>
                                <GroupTaskInputRow
                                    key={`${item.group.groupId}:${groupTaskInputGeneration}`}
                                    groupName={item.group.name}
                                    animate
                                    onSubmit={taskToCreate => {
                                        onCreateTaskInGroup?.(item.group, taskToCreate);
                                    }}
                                    onEscape={() => setAddingGroupId(null)}
                                    onBlur={() => setAddingGroupId(null)}
                                />
                            </Fade>
                        </Collapse>
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

            {(contentMounted || expanded) && (
                <Box
                    aria-hidden={!animatedExpanded}
                    sx={{
                        display: 'grid',
                        gridTemplateRows: animatedExpanded ? '1fr' : '0fr',
                        opacity: animatedExpanded ? 1 : 0,
                        transition: 'grid-template-rows 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 140ms ease',
                    }}
                >
                    <Box sx={{ minHeight: 0, overflow: 'hidden' }}>
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
                    </Box>
                </Box>
            )}
        </Box>
    );
});
