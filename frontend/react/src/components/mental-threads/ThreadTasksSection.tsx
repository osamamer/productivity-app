import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Popover,
    Stack,
    Typography,
    alpha,
} from '@mui/material';
import { Task } from '../../types/Task.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';
import { FlatTaskRow } from '../FlatTaskRow.tsx';
import { SmartTaskInput } from '../input/SmartTaskInput.tsx';

interface ThreadTasksSectionProps {
    tasks: Task[];
    canAddTasks: boolean;
    readOnly?: boolean;
    onCreate: (task: TaskToCreate) => Promise<Task>;
    onToggle: (task: Task) => Promise<void>;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
    onDelete: (task: Task) => Promise<void>;
}

function compareThreadTasks(first: Task, second: Task): number {
    // Creation time keeps tasks made before the append fix in the expected
    // order too; displayOrder remains the persisted tie-breaker.
    const creationOrder = first.creationDateTime.localeCompare(second.creationDateTime);
    if (creationOrder !== 0) return creationOrder;
    if (first.displayOrder !== second.displayOrder) return first.displayOrder - second.displayOrder;
    return first.taskId.localeCompare(second.taskId);
}

export function ThreadTasksSection({
    tasks,
    canAddTasks,
    readOnly = false,
    onCreate,
    onToggle,
    onUpdate,
    onDelete,
}: ThreadTasksSectionProps) {
    const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [deleteRequest, setDeleteRequest] = useState<{ task: Task; anchorEl: HTMLElement } | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [newTaskId, setNewTaskId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const taskRowRefs = useRef(new Map<string, HTMLDivElement>());
    const previousTaskPositions = useRef(new Map<string, DOMRect>());

    const handleCreate = async (task: TaskToCreate) => {
        setError(null);
        try {
            const createdTask = await onCreate(task);
            setNewTaskId(createdTask.taskId);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Could not create the task.');
        }
    };

    const handleToggle = async (task: Task) => {
        if (readOnly || pendingTaskId) return;
        setPendingTaskId(task.taskId);
        setError(null);
        try {
            await onToggle(task);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Could not update the task.');
        } finally {
            setPendingTaskId(null);
        }
    };

    const handleToggleById = (taskId: string) => {
        const task = tasks.find(candidate => candidate.taskId === taskId);
        if (task) void handleToggle(task);
    };

    const handleUpdate = async (taskId: string, updates: Partial<Task>) => {
        if (readOnly) return;
        setError(null);
        try {
            await onUpdate(taskId, updates);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Could not update the task.');
        }
    };

    const handleTogglePanel = (taskId: string, panel: 'pomodoro' | 'details') => {
        if (readOnly || panel !== 'details') return;
        setExpandedTaskId(current => current === taskId ? null : taskId);
    };

    const handleDeleteRequest = (task: Task, anchorEl: HTMLElement) => {
        if (!readOnly && !deleteSubmitting) setDeleteRequest({ task, anchorEl });
    };

    const handleDelete = async () => {
        if (!deleteRequest || deleteSubmitting) return;

        const task = deleteRequest.task;
        setDeleteSubmitting(true);
        setDeleteRequest(null);
        setError(null);
        try {
            await onDelete(task);
            setExpandedTaskId(current => current === task.taskId ? null : current);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Could not delete the task.');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const completedCount = tasks.filter(task => task.completed).length;
    const orderedTasks = useMemo(
        () => [...tasks].sort(compareThreadTasks),
        [tasks],
    );

    useEffect(() => {
        if (!newTaskId) return;
        const timeoutId = window.setTimeout(() => setNewTaskId(null), 360);
        return () => window.clearTimeout(timeoutId);
    }, [newTaskId]);

    useLayoutEffect(() => {
        const nextPositions = new Map<string, DOMRect>();
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        orderedTasks.forEach(task => {
            const element = taskRowRefs.current.get(task.taskId);
            if (!element) return;

            const nextPosition = element.getBoundingClientRect();
            nextPositions.set(task.taskId, nextPosition);
            const previousPosition = previousTaskPositions.current.get(task.taskId);
            if (!previousPosition || reducedMotion) return;

            const deltaX = previousPosition.left - nextPosition.left;
            const deltaY = previousPosition.top - nextPosition.top;
            if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

            element.animate(
                [
                    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
                    { transform: 'translate3d(0, 0, 0)' },
                ],
                { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
            );
        });

        previousTaskPositions.current = nextPositions;
    }, [orderedTasks]);

    if (readOnly && tasks.length === 0) return null;

    return (
        <Box sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
                <Typography variant="overline" color="text.secondary">Next actions</Typography>
                {tasks.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                        {completedCount}/{tasks.length} done
                    </Typography>
                )}
            </Stack>

            <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                {orderedTasks.map(task => (
                    <Box
                        key={task.taskId}
                        ref={element => {
                            if (element) taskRowRefs.current.set(task.taskId, element as HTMLDivElement);
                            else taskRowRefs.current.delete(task.taskId);
                        }}
                        sx={task.taskId === newTaskId ? {
                            animation: 'threadTaskEnter 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                            '@keyframes threadTaskEnter': {
                                from: { opacity: 0, transform: 'translateY(-8px)' },
                                to: { opacity: 1, transform: 'translateY(0)' },
                            },
                            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                        } : undefined}
                    >
                        <FlatTaskRow
                            task={task}
                            onToggle={handleToggleById}
                            onUpdate={handleUpdate}
                            expandedPanel={!readOnly && expandedTaskId === task.taskId ? 'details' : null}
                            onTogglePanel={handleTogglePanel}
                            onAutoExpand={() => undefined}
                            showPomodoroButton={false}
                            showDetailsButton={!readOnly}
                            onDelete={readOnly ? undefined : handleDeleteRequest}
                            readOnly={readOnly}
                            deferPomodoroHydration
                        />
                    </Box>
                ))}
            </Stack>

            <Popover
                open={deleteRequest !== null}
                anchorEl={deleteRequest?.anchorEl}
                onClose={() => !deleteSubmitting && setDeleteRequest(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 1.5,
                            width: 270,
                            maxWidth: 'calc(100vw - 32px)',
                            borderRadius: 2.5,
                        },
                    },
                }}
            >
                {deleteRequest && (
                    <Box>
                        <Typography variant="body2" sx={{ mb: 1.25 }}>
                            Delete “{deleteRequest.task.name}” and its subtasks?
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                            <Button
                                size="small"
                                onClick={() => setDeleteRequest(null)}
                                disabled={deleteSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="small"
                                color="error"
                                variant="contained"
                                onClick={() => void handleDelete()}
                                disabled={deleteSubmitting}
                            >
                                {deleteSubmitting ? <CircularProgress size={16} color="inherit" /> : 'Delete'}
                            </Button>
                        </Box>
                    </Box>
                )}
            </Popover>

            {canAddTasks && !readOnly && (
                <Box sx={theme => ({
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 42,
                    mt: tasks.length > 0 ? 0.5 : 0,
                    borderRadius: 1.5,
                    px: 0.5,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                    '& .MuiInput-underline:before, & .MuiInput-underline:after, & .MuiInput-underline:hover:not(.Mui-disabled):before': {
                        borderBottom: 'none',
                    },
                    '& .MuiInputBase-input': {
                        py: 0.75,
                        fontSize: '1.05rem',
                        lineHeight: 1.5,
                    },
                    '& .MuiInputBase-input::placeholder': {
                        color: theme.palette.text.secondary,
                        opacity: 1,
                    },
                })}>
                    <Checkbox
                        size="small"
                        disabled
                        checked={false}
                        sx={{ mr: 0.5, color: 'text.disabled' }}
                        inputProps={{ 'aria-label': 'New next action' }}
                    />
                    <SmartTaskInput
                        onSubmit={handleCreate}
                        placeholder="Next Action..."
                        submitOnBlur
                    />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </Box>
    );
}
