import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    TextField,
    Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { taskGroupService, taskService } from '../services/api';
import { Task } from '../types/Task';
import { TaskGroup } from '../types/TaskGroup';
import { PageWrapper } from '../components/PageWrapper';
import { useGlobalTasks } from '../contexts/TaskContext';
import { useUser } from '../contexts/UserContext';
import { SmartTaskInput } from '../components/input/SmartTaskInput';
import { FlatTaskRow } from '../components/FlatTaskRow';
import { TaskToCreate } from '../types/TaskToCreate';
import { DayWidget } from '../components/DayWidget';

type ActiveExpansion = { taskId: string; panel: 'pomodoro' | 'details' } | null;
type FocusVisibility = 'all' | 'fading' | 'hidden' | 'revealing';
type TaskListItem =
    | { kind: 'task'; task: Task }
    | { kind: 'group'; group: TaskGroup; tasks: Task[] };

const greetingReveal = keyframes`
    from {
        opacity: 0;
        transform: translateX(-32px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
`;

const focusTaskReveal = keyframes`
    from {
        opacity: 0.65;
        transform: translateY(10px) scale(0.985);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
`;

const tasksFadeAway = keyframes`
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(9px);
    }
`;

const tasksFadeBack = keyframes`
    from {
        opacity: 0;
        transform: translateY(7px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

function buildTaskListItems(tasks: Task[], groups: TaskGroup[]): TaskListItem[] {
    const visibleTaskIds = new Set(tasks.map(task => task.taskId));
    const groupByTaskId = new Map<string, TaskGroup>();

    [...groups]
        .sort((first, second) => first.displayOrder - second.displayOrder)
        .forEach(group => {
            group.taskIds.forEach(taskId => {
                if (visibleTaskIds.has(taskId) && !groupByTaskId.has(taskId)) {
                    groupByTaskId.set(taskId, group);
                }
            });
        });

    const emittedGroupIds = new Set<string>();
    const items: TaskListItem[] = [];

    tasks.forEach(task => {
        const group = groupByTaskId.get(task.taskId);
        if (!group) {
            items.push({ kind: 'task', task });
            return;
        }
        if (emittedGroupIds.has(group.groupId)) return;

        emittedGroupIds.add(group.groupId);
        items.push({
            kind: 'group',
            group,
            tasks: tasks.filter(candidate => groupByTaskId.get(candidate.taskId)?.groupId === group.groupId),
        });
    });

    return items;
}

export function HomePage() {
    const { user } = useUser();
    const [activeExpansion, setActiveExpansion] = useState<ActiveExpansion>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupSubmitting, setGroupSubmitting] = useState(false);
    const [groups, setGroups] = useState<TaskGroup[] | null>(null);
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
    const [dragTargetTaskId, setDragTargetTaskId] = useState<string | null>(null);
    const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
    const [dragTargetBottom, setDragTargetBottom] = useState(false);
    const [activePomodoroTaskId, setActivePomodoroTaskId] = useState<string | null>(null);
    const [focusVisibility, setFocusVisibility] = useState<FocusVisibility>('all');
    const selectionAnchorRef = useRef<string | null>(null);
    const activePomodoroTaskIdRef = useRef<string | null>(null);
    const focusTransitionTimerRef = useRef<number | null>(null);
    const temporarilyCollapsedGroupIdRef = useRef<string | null>(null);

    const {
        allTasks,
        todayTasks,
        pastTasks,
        refreshTaskBuckets,
        addTaskToState,
        updateTaskInState,
        reorderTasksInState,
    } = useGlobalTasks();

    const visibleTasks = useMemo(() => todayTasks.filter(task => !task.parentId), [todayTasks]);
    const activePomodoroTask = useMemo(
        () => visibleTasks.find(task => task.taskId === activePomodoroTaskId) ?? null,
        [activePomodoroTaskId, visibleTasks],
    );
    const tasksBelowFocus = useMemo(
        () => activePomodoroTask
            ? visibleTasks.filter(task => task.taskId !== activePomodoroTask.taskId)
            : visibleTasks,
        [activePomodoroTask, visibleTasks],
    );
    const taskListItems = useMemo(
        () => buildTaskListItems(tasksBelowFocus, groups ?? []),
        [groups, tasksBelowFocus],
    );
    const renderedTaskIds = useMemo(() => {
        const taskIds = activePomodoroTask ? [activePomodoroTask.taskId] : [];
        taskListItems.forEach(item => {
            if (item.kind === 'task') {
                taskIds.push(item.task.taskId);
            } else if (!collapsedGroupIds.has(item.group.groupId)) {
                taskIds.push(...item.tasks.map(task => task.taskId));
            }
        });
        return taskIds;
    }, [activePomodoroTask, collapsedGroupIds, taskListItems]);

    const clearFocusTransitionTimer = useCallback(() => {
        if (focusTransitionTimerRef.current !== null) {
            window.clearTimeout(focusTransitionTimerRef.current);
            focusTransitionTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        taskGroupService.getGroups()
            .then(setGroups)
            .catch(err => {
                console.error('Error fetching task groups:', err);
                setGroups([]);
            });
    }, []);

    useEffect(() => () => clearFocusTransitionTimer(), [clearFocusTransitionTimer]);

    async function createTask(task: TaskToCreate) {
        try {
            const created = await taskService.createTask(task);
            addTaskToState(created);
        } catch (err) {
            console.error('Error creating task:', err);
            await refreshTaskBuckets();
        }
    }

    async function updateTask(taskId: string, updates: Partial<Task>) {
        const originalTask = allTasks.find(task => task.taskId === taskId);
        updateTaskInState(taskId, updates);
        try {
            await taskService.updateTask(taskId, updates);
        } catch (err) {
            console.error('Error updating task:', err);
            if (originalTask) updateTaskInState(taskId, originalTask);
            await refreshTaskBuckets();
        }
    }

    async function toggleTaskCompletion(taskId: string) {
        const task = allTasks.find(existingTask => existingTask.taskId === taskId);
        if (task) updateTaskInState(taskId, { completed: !task.completed });
        try {
            await taskService.toggleTaskCompletion(taskId, task ? !task.completed : undefined);
        } catch (err) {
            console.error('Error toggling task:', err);
            if (task) updateTaskInState(taskId, { completed: task.completed });
        }
    }

    function handleTogglePanel(taskId: string, panel: 'pomodoro' | 'details') {
        setActiveExpansion(previous =>
            previous?.taskId === taskId && previous?.panel === panel ? null : { taskId, panel },
        );
    }

    const handleTaskSelection = useCallback((task: Task, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        const taskId = task.taskId;
        const anchorId = selectionAnchorRef.current;

        if (event.shiftKey && anchorId) {
            const anchorIndex = renderedTaskIds.indexOf(anchorId);
            const taskIndex = renderedTaskIds.indexOf(taskId);
            if (anchorIndex !== -1 && taskIndex !== -1) {
                const rangeStart = Math.min(anchorIndex, taskIndex);
                const rangeEnd = Math.max(anchorIndex, taskIndex);
                const rangeIds = renderedTaskIds.slice(rangeStart, rangeEnd + 1);
                setSelectedTaskIds(previous => [...new Set([...previous, ...rangeIds])]);
                return;
            }
        }

        if (event.ctrlKey || event.metaKey) {
            setSelectedTaskIds(previous => previous.includes(taskId)
                ? previous.filter(selectedTaskId => selectedTaskId !== taskId)
                : [...previous, taskId]);
            selectionAnchorRef.current = taskId;
            return;
        }

        setSelectedTaskIds([taskId]);
        selectionAnchorRef.current = taskId;
    }, [renderedTaskIds]);

    const handlePomodoroActiveChange = useCallback((taskId: string, active: boolean) => {
        if (active) {
            if (activePomodoroTaskIdRef.current === taskId) return;

            clearFocusTransitionTimer();
            activePomodoroTaskIdRef.current = taskId;
            setActivePomodoroTaskId(taskId);
            setSelectedTaskIds([]);
            setFocusVisibility('fading');
            focusTransitionTimerRef.current = window.setTimeout(() => {
                setFocusVisibility('hidden');
                focusTransitionTimerRef.current = null;
            }, 280);
            return;
        }

        if (activePomodoroTaskIdRef.current !== taskId) return;

        clearFocusTransitionTimer();
        activePomodoroTaskIdRef.current = null;
        setActivePomodoroTaskId(null);
        setFocusVisibility('all');
    }, [clearFocusTransitionTimer]);

    const showAllTasks = useCallback(() => {
        clearFocusTransitionTimer();
        setFocusVisibility('revealing');
        focusTransitionTimerRef.current = window.setTimeout(() => {
            setFocusVisibility('all');
            focusTransitionTimerRef.current = null;
        }, 260);
    }, [clearFocusTransitionTimer]);

    const finishDragging = useCallback(() => {
        const temporarilyCollapsedGroupId = temporarilyCollapsedGroupIdRef.current;
        if (temporarilyCollapsedGroupId) {
            setCollapsedGroupIds(previous => {
                const next = new Set(previous);
                next.delete(temporarilyCollapsedGroupId);
                return next;
            });
            temporarilyCollapsedGroupIdRef.current = null;
        }
        setDraggedTaskId(null);
        setDraggedGroupId(null);
        setDragTargetTaskId(null);
        setDragTargetGroupId(null);
        setDragTargetBottom(false);
    }, []);

    const persistTaskOrder = useCallback((orderedTaskIds: string[]) => {
        reorderTasksInState(orderedTaskIds);
        taskService.reorderTasks(orderedTaskIds).catch(err => {
            console.error('Error reordering tasks:', err);
            refreshTaskBuckets();
        });
    }, [refreshTaskBuckets, reorderTasksInState]);

    const reorderGroupBeforeTask = useCallback((groupId: string, targetTaskId: string) => {
        const group = groups?.find(candidate => candidate.groupId === groupId);
        if (!group || group.taskIds.includes(targetTaskId)) return;

        const visibleTaskIds = visibleTasks.map(task => task.taskId);
        const visibleGroupTaskIds = visibleTaskIds.filter(taskId => group.taskIds.includes(taskId));
        if (visibleGroupTaskIds.length === 0) return;

        const groupTaskIdSet = new Set(visibleGroupTaskIds);
        const orderWithoutGroup = visibleTaskIds.filter(taskId => !groupTaskIdSet.has(taskId));
        const targetIndex = orderWithoutGroup.indexOf(targetTaskId);
        if (targetIndex === -1) return;

        orderWithoutGroup.splice(targetIndex, 0, ...visibleGroupTaskIds);
        persistTaskOrder(orderWithoutGroup);
    }, [groups, persistTaskOrder, visibleTasks]);

    const handleDropOnTask = useCallback((targetTask: Task) => {
        if (draggedGroupId) {
            reorderGroupBeforeTask(draggedGroupId, targetTask.taskId);
            finishDragging();
            return;
        }

        if (!draggedTaskId || draggedTaskId === targetTask.taskId) {
            finishDragging();
            return;
        }

        const orderedTaskIds = visibleTasks.map(task => task.taskId);
        const sourceIndex = orderedTaskIds.indexOf(draggedTaskId);
        if (sourceIndex === -1 || !orderedTaskIds.includes(targetTask.taskId)) return;

        orderedTaskIds.splice(sourceIndex, 1);
        const targetIndex = orderedTaskIds.indexOf(targetTask.taskId);
        orderedTaskIds.splice(targetIndex, 0, draggedTaskId);
        persistTaskOrder(orderedTaskIds);
        finishDragging();
    }, [draggedGroupId, draggedTaskId, finishDragging, persistTaskOrder, reorderGroupBeforeTask, visibleTasks]);

    const handleDropOnGroup = useCallback((targetGroup: TaskGroup, targetTasks: Task[]) => {
        const targetTaskId = targetTasks[0]?.taskId;
        if (!targetTaskId) {
            finishDragging();
            return;
        }

        if (draggedGroupId) {
            if (draggedGroupId !== targetGroup.groupId) {
                reorderGroupBeforeTask(draggedGroupId, targetTaskId);
            }
            finishDragging();
            return;
        }

        if (draggedTaskId && !targetGroup.taskIds.includes(draggedTaskId)) {
            const orderedTaskIds = visibleTasks.map(task => task.taskId);
            const sourceIndex = orderedTaskIds.indexOf(draggedTaskId);
            if (sourceIndex !== -1 && orderedTaskIds.includes(targetTaskId)) {
                orderedTaskIds.splice(sourceIndex, 1);
                const targetIndex = orderedTaskIds.indexOf(targetTaskId);
                orderedTaskIds.splice(targetIndex, 0, draggedTaskId);
                persistTaskOrder(orderedTaskIds);
            }
        }
        finishDragging();
    }, [draggedGroupId, draggedTaskId, finishDragging, persistTaskOrder, reorderGroupBeforeTask, visibleTasks]);

    const handleDropAtBottom = useCallback(() => {
        const orderedTaskIds = visibleTasks.map(task => task.taskId);

        if (draggedGroupId) {
            const group = groups?.find(candidate => candidate.groupId === draggedGroupId);
            if (group) {
                const visibleGroupTaskIds = orderedTaskIds.filter(taskId => group.taskIds.includes(taskId));
                const groupTaskIdSet = new Set(visibleGroupTaskIds);
                const orderWithoutGroup = orderedTaskIds.filter(taskId => !groupTaskIdSet.has(taskId));
                persistTaskOrder([...orderWithoutGroup, ...visibleGroupTaskIds]);
            }
            finishDragging();
            return;
        }

        if (draggedTaskId) {
            const sourceIndex = orderedTaskIds.indexOf(draggedTaskId);
            if (sourceIndex !== -1) {
                orderedTaskIds.splice(sourceIndex, 1);
                orderedTaskIds.push(draggedTaskId);
                persistTaskOrder(orderedTaskIds);
            }
        }
        finishDragging();
    }, [draggedGroupId, draggedTaskId, finishDragging, groups, persistTaskOrder, visibleTasks]);

    function clearSelection() {
        setSelectedTaskIds([]);
        selectionAnchorRef.current = null;
    }

    async function createGroup() {
        const trimmedName = groupName.trim();
        if (!trimmedName || selectedTaskIds.length < 2) return;

        setGroupSubmitting(true);
        try {
            const createdGroup = await taskGroupService.createGroup(trimmedName, selectedTaskIds);
            const selectedTaskIdSet = new Set(selectedTaskIds);
            setGroups(previous => [
                ...(previous ?? [])
                    .map(group => ({
                        ...group,
                        taskIds: group.taskIds.filter(taskId => !selectedTaskIdSet.has(taskId)),
                    }))
                    .filter(group => group.taskIds.length >= 2),
                createdGroup,
            ]);
            clearSelection();
            setGroupDialogOpen(false);
            setGroupName('');
        } catch (err) {
            console.error('Error creating task group:', err);
        } finally {
            setGroupSubmitting(false);
        }
    }

    async function deleteGroup(group: TaskGroup) {
        try {
            await taskGroupService.deleteGroup(group.groupId);
            setGroups(previous => (previous ?? []).filter(existingGroup => existingGroup.groupId !== group.groupId));
            setCollapsedGroupIds(previous => {
                const next = new Set(previous);
                next.delete(group.groupId);
                return next;
            });
        } catch (err) {
            console.error('Error deleting task group:', err);
        }
    }

    function toggleGroup(groupId: string) {
        setCollapsedGroupIds(previous => {
            const next = new Set(previous);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    }

    function renderTaskRow(task: Task) {
        return (
            <FlatTaskRow
                key={task.taskId}
                task={task}
                onToggle={toggleTaskCompletion}
                onUpdate={updateTask}
                expandedPanel={activeExpansion?.taskId === task.taskId ? activeExpansion.panel : null}
                onTogglePanel={(panel) => handleTogglePanel(task.taskId, panel)}
                onAutoExpand={(panel) => setActiveExpansion({ taskId: task.taskId, panel })}
                selected={selectedTaskIds.includes(task.taskId)}
                onSelectionClick={handleTaskSelection}
                reorderable={!activePomodoroTask}
                onDragStart={(draggedTask) => {
                    setDraggedTaskId(draggedTask.taskId);
                    setDraggedGroupId(null);
                    setDragTargetTaskId(null);
                    setDragTargetGroupId(null);
                    setDragTargetBottom(false);
                }}
                onDragOver={(dragTargetTask) => {
                    if ((draggedTaskId && draggedTaskId !== dragTargetTask.taskId) || draggedGroupId) {
                        setDragTargetTaskId(dragTargetTask.taskId);
                        setDragTargetGroupId(null);
                        setDragTargetBottom(false);
                    }
                }}
                onDrop={handleDropOnTask}
                onDragEnd={finishDragging}
                isDragging={draggedTaskId === task.taskId}
                isDragTarget={dragTargetTaskId === task.taskId}
                onPomodoroActiveChange={handlePomodoroActiveChange}
            />
        );
    }

    function renderTaskList(items: TaskListItem[]) {
        return items.map(item => {
            if (item.kind === 'task') return renderTaskRow(item.task);

            const collapsed = collapsedGroupIds.has(item.group.groupId);
            const groupDragging = draggedGroupId === item.group.groupId;
            const groupDragTarget = dragTargetGroupId === item.group.groupId;
            return (
                <Box key={item.group.groupId} sx={{ mb: 0.4 }}>
                    <Box
                        draggable={!activePomodoroTask}
                        onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', `group:${item.group.groupId}`);
                            if (!collapsed) {
                                temporarilyCollapsedGroupIdRef.current = item.group.groupId;
                                setCollapsedGroupIds(previous => new Set(previous).add(item.group.groupId));
                            } else {
                                temporarilyCollapsedGroupIdRef.current = null;
                            }
                            setDraggedGroupId(item.group.groupId);
                            setDraggedTaskId(null);
                            setDragTargetGroupId(null);
                            setDragTargetTaskId(null);
                            setDragTargetBottom(false);
                        }}
                        onDragOver={(event) => {
                            if (activePomodoroTask) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            if (draggedGroupId !== item.group.groupId || draggedTaskId) {
                                setDragTargetGroupId(item.group.groupId);
                                setDragTargetTaskId(null);
                                setDragTargetBottom(false);
                            }
                        }}
                        onDrop={(event) => {
                            if (activePomodoroTask) return;
                            event.preventDefault();
                            event.stopPropagation();
                            handleDropOnGroup(item.group, item.tasks);
                        }}
                        onDragEnd={finishDragging}
                        sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 42,
                            borderRadius: 1.5,
                            px: 0.35,
                            color: 'text.secondary',
                            opacity: groupDragging ? 0.42 : 1,
                            transform: groupDragging ? 'scale(0.98)' : 'scale(1)',
                            backgroundColor: groupDragTarget ? 'action.hover' : 'transparent',
                            transition: 'opacity 0.16s, transform 0.16s, background-color 0.18s',
                            '&:hover': { backgroundColor: 'action.hover' },
                            '&::before': groupDragTarget ? {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 10,
                                right: 10,
                                height: 2,
                                borderRadius: 2,
                                backgroundColor: 'primary.main',
                            } : undefined,
                        }}
                    >
                        <IconButton
                            size="small"
                            aria-label={collapsed ? `Expand ${item.group.name}` : `Collapse ${item.group.name}`}
                            onClick={() => toggleGroup(item.group.groupId)}
                        >
                            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                        <Typography
                            variant="body2"
                            onClick={() => toggleGroup(item.group.groupId)}
                            sx={{ flex: 1, textAlign: 'left', fontWeight: 650, cursor: 'pointer' }}
                        >
                            {item.group.name}
                            <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                                {item.tasks.length}
                            </Typography>
                        </Typography>
                        <Button size="small" color="inherit" onClick={() => deleteGroup(item.group)}>
                            Ungroup
                        </Button>
                    </Box>
                    <Collapse in={!collapsed} timeout={210} unmountOnExit>
                        <Box sx={{ ml: 1.7, pl: 1.1, borderLeft: '1px solid', borderColor: 'divider' }}>
                            {item.tasks.map(renderTaskRow)}
                        </Box>
                    </Collapse>
                </Box>
            );
        });
    }

    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'Good wee hours' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user?.firstName || user?.username || '';
    const overdueCount = pastTasks.filter(task => !task.completed).length;
    const showTasksBelowFocus = !activePomodoroTask || focusVisibility !== 'hidden';

    return (
        <PageWrapper>
            <Box sx={{ position: 'relative', flex: 1 }} onClick={clearSelection}>
                <Box sx={{ maxWidth: 500, width: '100%', mx: 'auto', pt: 10, pb: 8, px: 2 }}>
                    <Typography
                        variant="h4"
                        color="text.secondary"
                        sx={{
                            mb: 4,
                            fontWeight: 400,
                            opacity: 0,
                            animation: `${greetingReveal} 560ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards`,
                        }}
                    >
                        {greeting}{firstName ? `, ${firstName}` : ''}.
                    </Typography>

                    <Box
                        sx={{
                            backgroundColor: 'background.paper',
                            borderRadius: 3,
                            px: 2.5,
                            py: 1.5,
                            mb: 5,
                            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                            '& .MuiInput-underline:before': { borderBottom: 'none' },
                            '& .MuiInput-underline:after': { borderBottom: 'none' },
                            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                            '& .MuiInput-root': { fontSize: '1.1rem' },
                        }}
                    >
                        <SmartTaskInput onSubmit={createTask} />
                    </Box>

                    {selectedTaskIds.length > 1 && (
                        <Box
                            onClick={event => event.stopPropagation()}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 0.75,
                                mb: 1.25,
                                animation: `${tasksFadeBack} 180ms ease-out`,
                            }}
                        >
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
                                {selectedTaskIds.length} selected
                            </Typography>
                            <Button size="small" color="inherit" onClick={clearSelection}>Clear</Button>
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<GroupWorkIcon />}
                                onClick={() => setGroupDialogOpen(true)}
                            >
                                Group
                            </Button>
                        </Box>
                    )}

                    {groups !== null && visibleTasks.length > 0 ? (
                        <>
                            {activePomodoroTask && (
                                <Box sx={{ animation: `${focusTaskReveal} 280ms cubic-bezier(0.22, 1, 0.36, 1)` }}>
                                    {renderTaskRow(activePomodoroTask)}
                                </Box>
                            )}

                            {activePomodoroTask && focusVisibility === 'hidden' && tasksBelowFocus.length > 0 && (
                                <Button
                                    size="small"
                                    startIcon={<VisibilityIcon />}
                                    onClick={showAllTasks}
                                    sx={{ mt: 1, mb: 0.75 }}
                                >
                                    Show all tasks
                                </Button>
                            )}

                            {showTasksBelowFocus && (
                                <Box
                                    sx={{
                                        animation: focusVisibility === 'fading'
                                            ? `${tasksFadeAway} 280ms ease-in forwards`
                                            : focusVisibility === 'revealing'
                                                ? `${tasksFadeBack} 260ms ease-out`
                                                : 'none',
                                        pointerEvents: focusVisibility === 'fading' ? 'none' : 'auto',
                                    }}
                                >
                                    {renderTaskList(taskListItems)}
                                    {!activePomodoroTask && (
                                        <Box
                                            aria-hidden="true"
                                            onDragOver={(event) => {
                                                if (!draggedTaskId && !draggedGroupId) return;
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = 'move';
                                                setDragTargetBottom(true);
                                                setDragTargetTaskId(null);
                                                setDragTargetGroupId(null);
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                handleDropAtBottom();
                                            }}
                                            sx={{
                                                position: 'relative',
                                                height: 32,
                                                '&::before': dragTargetBottom ? {
                                                    content: '""',
                                                    position: 'absolute',
                                                    top: 8,
                                                    left: 10,
                                                    right: 10,
                                                    height: 2,
                                                    borderRadius: 2,
                                                    backgroundColor: 'primary.main',
                                                } : undefined,
                                            }}
                                        />
                                    )}
                                </Box>
                            )}
                        </>
                    ) : groups !== null ? (
                        <Typography variant="body1" color="text.secondary">
                            Nothing scheduled for today.
                        </Typography>
                    ) : null}

                    {overdueCount > 0 && (
                        <Typography variant="body2" sx={{ mt: 4, color: 'warning.main', fontWeight: 500 }}>
                            {overdueCount} task{overdueCount > 1 ? 's' : ''} from earlier still waiting.
                        </Typography>
                    )}
                </Box>

                <Dialog
                    open={groupDialogOpen}
                    onClose={() => !groupSubmitting && setGroupDialogOpen(false)}
                    onClick={event => event.stopPropagation()}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>Group selected tasks</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Group name"
                            placeholder="Morning routine"
                            value={groupName}
                            onChange={event => setGroupName(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    createGroup();
                                }
                            }}
                            disabled={groupSubmitting}
                            sx={{ mt: 1 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setGroupDialogOpen(false)} disabled={groupSubmitting}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={createGroup}
                            disabled={groupSubmitting || !groupName.trim()}
                            startIcon={groupSubmitting ? <CircularProgress size={14} /> : <GroupWorkIcon />}
                        >
                            Create group
                        </Button>
                    </DialogActions>
                </Dialog>

                <DayWidget />
            </Box>
        </PageWrapper>
    );
}

export default HomePage;
