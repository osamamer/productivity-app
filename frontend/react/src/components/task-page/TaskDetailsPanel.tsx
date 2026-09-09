import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box,
    Chip,
    Checkbox,
    Collapse,
    IconButton,
    TextField,
    Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Task } from '../../types/Task.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';
import { TaskSeries } from '../../types/TaskSeries';
import { defaultTaskRecurrence, TaskRecurrenceDraft } from '../../types/TaskRecurrence';
import { TaskPomodoroStats } from '../../types/TaskPomodoroStats';
import { taskService } from '../../services/api';
import { AppDateField } from '../input/AppPickerFields';
import { TaskRecurrenceCustomOptions, TaskRecurrencePicker } from '../task/TaskRecurrencePicker';
import { TaskReminderPicker } from '../task/TaskReminderPicker';
import { playAudioFeedback } from '../../services/audioFeedback';
import {
    getStaleTaskPomodoroStats,
    loadTaskPomodoroStats,
    subscribeToTaskPomodoroStatsInvalidation,
} from '../../services/cache/taskPomodoroStatsCache';
import {
    getStaleTaskDetails,
    updateCachedTaskDetails,
} from '../../services/cache/taskDetailsCache';

type TaskDetailsPanelProps = {
    task: Task;
    onClose: () => void;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
    onToggleCompletion: (taskId: string) => void;
    onDelete: (task: Task, anchorEl: HTMLElement) => void;
    onCreateSubtask: (task: TaskToCreate) => Promise<Task>;
    onRefreshTasks?: () => Promise<void>;
};

type DescriptionDraft = {
    taskId: string;
    source: string;
    value: string;
};

type SubtaskState = {
    taskId: string;
    items: Task[];
    loading: boolean;
};

type PomodoroStatsState = {
    taskId: string;
    stats: TaskPomodoroStats | null;
    loading: boolean;
    error: boolean;
};

type SubtaskListProps = {
    items: Task[];
    onToggle: (subtask: Task) => Promise<void>;
};

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

const EMPTY_SUBTASKS: Task[] = [];
const TASK_NAME_SCALE_START = 48;
const TASK_NAME_SCALE_END = 240;

function areSubtasksEqual(previous: Task[], next: Task[]): boolean {
    if (previous.length !== next.length) return false;

    return previous.every((subtask, index) => {
        const nextSubtask = next[index];
        return subtask.taskId === nextSubtask.taskId
            && subtask.name === nextSubtask.name
            && subtask.description === nextSubtask.description
            && subtask.completed === nextSubtask.completed
            && subtask.creationDateTime === nextSubtask.creationDateTime
            && subtask.creationDate === nextSubtask.creationDate
            && subtask.scheduledPerformDateTime === nextSubtask.scheduledPerformDateTime
            && subtask.reminderMinutesBefore === nextSubtask.reminderMinutesBefore
            && subtask.completionDateTime === nextSubtask.completionDateTime
            && subtask.parentId === nextSubtask.parentId
            && subtask.tag === nextSubtask.tag
            && subtask.importance === nextSubtask.importance
            && subtask.displayOrder === nextSubtask.displayOrder
            && subtask.mentalThreadId === nextSubtask.mentalThreadId;
    });
}

function getTaskNameFontSize(name: string): string {
    const scale = Math.min(
        1,
        Math.max(0, (name.trim().length - TASK_NAME_SCALE_START)
            / (TASK_NAME_SCALE_END - TASK_NAME_SCALE_START)),
    );
    return `${(1.5 - (0.5 * scale)).toFixed(2)}rem`;
}

function formatTaskDateTime(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function getPriorityLabel(importance: number): string {
    if (importance > 7) return 'High';
    if (importance > 4) return 'Medium';
    return 'Low';
}

function recurrenceDraftFromSeries(series: TaskSeries | null | undefined): TaskRecurrenceDraft {
    if (!series?.active) return defaultTaskRecurrence();
    return {
        recurrenceFrequency: series.recurrenceFrequency,
        recurrenceEndDate: series.recurrenceEndDate,
        recurrenceInterval: series.recurrenceInterval,
        recurrenceUnit: series.recurrenceUnit,
        timeZone: series.timeZone,
    };
}

function formatFocusTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${minutes}m`;
    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

function formatWorkedDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) return date;
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(year, month - 1, day));
}

const FocusStat = React.memo(function FocusStat({ label, value }: { label: string; value: string | number }) {
    return (
        <Box sx={{ p: 1.25, borderRadius: 2, backgroundColor: 'action.hover' }}>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
        </Box>
    );
});

const SubtaskComposer = React.memo(function SubtaskComposer({
    taskId,
    onSubmit,
}: {
    taskId: string;
    onSubmit: (name: string) => Promise<void>;
}) {
    const [draft, setDraft] = useState({ taskId, name: '', focused: false });
    const visibleDraft = draft.taskId === taskId
        ? draft
        : { taskId, name: '', focused: false };

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = visibleDraft.name.trim();
        if (!trimmedName) return;

        await onSubmit(trimmedName);
        setDraft({ taskId, name: '', focused: visibleDraft.focused });
    };

    return (
        <Box
            component="form"
            onSubmit={submit}
            sx={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: visibleDraft.focused ? 'primary.main' : 'divider',
                transition: 'border-color 0.15s ease',
            }}
        >
            <Checkbox
                size="small"
                disabled
                checked={false}
                sx={{ p: 0.5, mr: 0.5, color: 'text.disabled' }}
                inputProps={{ 'aria-label': 'New subtask' }}
            />
            <TextField
                value={visibleDraft.name}
                autoComplete="off"
                onChange={event => setDraft({ taskId, name: event.target.value, focused: visibleDraft.focused })}
                onFocus={() => setDraft({ ...visibleDraft, focused: true })}
                onBlur={() => setDraft({ ...visibleDraft, focused: false })}
                placeholder="Add a subtask"
                variant="standard"
                fullWidth
                InputProps={{ disableUnderline: true }}
                sx={{ '& .MuiInputBase-input': { py: 1.25, fontSize: '0.875rem' } }}
            />
        </Box>
    );
});

const SubtaskList = React.memo(function SubtaskList({ items, onToggle }: SubtaskListProps) {
    return (
        <>
            {items.map(subtask => (
                <Box key={subtask.taskId} sx={{ display: 'flex', alignItems: 'center', minHeight: 38 }}>
                    <Checkbox
                        size="small"
                        checked={subtask.completed}
                        onChange={() => void onToggle(subtask)}
                        sx={{ p: 0.5, mr: 0.75 }}
                    />
                    <Typography
                        variant="body2"
                        sx={{
                            textAlign: 'left',
                            color: subtask.completed ? 'text.disabled' : 'text.primary',
                            textDecoration: subtask.completed ? 'line-through' : 'none',
                        }}
                    >
                        {subtask.name}
                    </Typography>
                </Box>
            ))}
        </>
    );
});

export const TaskDetailsPanel = React.memo(function TaskDetailsPanel({
    task,
    onClose,
    onUpdate,
    onToggleCompletion,
    onDelete,
    onCreateSubtask,
    onRefreshTasks,
}: TaskDetailsPanelProps) {
    const taskDescription = task.description ?? '';
    const [descriptionDraft, setDescriptionDraft] = useState<DescriptionDraft>({
        taskId: task.taskId,
        source: taskDescription,
        value: taskDescription,
    });
    const initialTaskDetails = getStaleTaskDetails(task.taskId);
    const [recurrenceDraft, setRecurrenceDraft] = useState<TaskRecurrenceDraft>(() =>
        recurrenceDraftFromSeries(initialTaskDetails?.taskSeries),
    );
    const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
    const recurrenceDraftRef = useRef<TaskRecurrenceDraft>(
        recurrenceDraftFromSeries(initialTaskDetails?.taskSeries),
    );
    const taskSeriesRef = useRef<TaskSeries | null>(initialTaskDetails?.taskSeries ?? null);
    const recurrenceMutationRef = useRef<Promise<void>>(Promise.resolve());
    const recurrenceRequestIdRef = useRef(0);
    const visibleDescription = descriptionDraft.taskId === task.taskId
        && descriptionDraft.source === taskDescription
        ? descriptionDraft.value
        : taskDescription;
    const [subtaskState, setSubtaskState] = useState<SubtaskState>({
        taskId: task.taskId,
        items: initialTaskDetails?.subtasks ?? EMPTY_SUBTASKS,
        loading: !initialTaskDetails,
    });
    const cachedTaskDetails = getStaleTaskDetails(task.taskId);
    const visibleSubtaskState = subtaskState.taskId === task.taskId
        ? subtaskState
        : {
            taskId: task.taskId,
            items: cachedTaskDetails?.subtasks ?? EMPTY_SUBTASKS,
            loading: !cachedTaskDetails,
        };
    const initialPomodoroStats = getStaleTaskPomodoroStats(task.taskId) ?? null;
    const [pomodoroStatsState, setPomodoroStatsState] = useState<PomodoroStatsState>({
        taskId: task.taskId,
        stats: initialPomodoroStats,
        loading: !initialPomodoroStats,
        error: false,
    });
    const cachedPomodoroStats = getStaleTaskPomodoroStats(task.taskId) ?? null;
    const visiblePomodoroStatsState = pomodoroStatsState.taskId === task.taskId
        ? pomodoroStatsState
        : {
            taskId: task.taskId,
            stats: cachedPomodoroStats,
            loading: !cachedPomodoroStats,
            error: false,
        };

    useEffect(() => {
        let cancelled = false;
        const taskId = task.taskId;
        const cached = getStaleTaskDetails(taskId);
        setRecurrenceError(null);
        if (cached) {
            const nextDraft = recurrenceDraftFromSeries(cached.taskSeries);
            taskSeriesRef.current = cached.taskSeries;
            recurrenceDraftRef.current = nextDraft;
            setRecurrenceDraft(nextDraft);
            setSubtaskState({ taskId, items: cached.subtasks, loading: false });
        } else {
            taskSeriesRef.current = null;
            recurrenceDraftRef.current = defaultTaskRecurrence();
            setRecurrenceDraft(recurrenceDraftRef.current);
            setSubtaskState({ taskId, items: EMPTY_SUBTASKS, loading: true });
        }

        taskService.getTaskDetails(task)
            .then(details => {
                if (cancelled) return;
                const nextDraft = recurrenceDraftFromSeries(details.taskSeries);
                taskSeriesRef.current = details.taskSeries;
                recurrenceDraftRef.current = nextDraft;
                setRecurrenceDraft(nextDraft);
                setSubtaskState(previous => {
                    const items = previous.taskId === taskId
                        && areSubtasksEqual(previous.items, details.subtasks)
                        ? previous.items
                        : details.subtasks;
                    return { taskId, items, loading: false };
                });
            })
            .catch(error => {
                if (cancelled) return;
                setSubtaskState(previous => ({
                    taskId,
                    items: previous.taskId === taskId ? previous.items : cached?.subtasks ?? EMPTY_SUBTASKS,
                    loading: false,
                }));
                setRecurrenceError('Unable to load task details.');
                console.error('Error fetching task details:', error);
            });

        return () => {
            cancelled = true;
        };
    }, [task]);

    useEffect(() => {
        let cancelled = false;
        const taskId = task.taskId;
        const cached = getStaleTaskPomodoroStats(taskId) ?? null;
        setPomodoroStatsState({
            taskId,
            stats: cached,
            loading: !cached,
            error: false,
        });

        const loadStats = async (forceRefresh = false) => {
            try {
                const nextStats = await loadTaskPomodoroStats(
                    taskId,
                    () => taskService.getPomodoroStats(taskId),
                    forceRefresh,
                );
                if (!cancelled) {
                    setPomodoroStatsState({
                        taskId,
                        stats: nextStats,
                        loading: false,
                        error: false,
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    setPomodoroStatsState(previous => ({
                        taskId,
                        // Keep the last value visible while a refresh fails.
                        stats: previous.taskId === taskId
                            ? previous.stats
                            : getStaleTaskPomodoroStats(taskId) ?? null,
                        loading: false,
                        error: true,
                    }));
                    console.error('Error fetching Pomodoro stats for task details:', error);
                }
            }
        };

        void loadStats();
        const unsubscribe = subscribeToTaskPomodoroStatsInvalidation(
            taskId,
            () => void loadStats(true),
        );
        const refreshInterval = window.setInterval(() => void loadStats(true), 15000);
        return () => {
            cancelled = true;
            unsubscribe();
            window.clearInterval(refreshInterval);
        };
    }, [task.taskId]);

    const scheduledDate = task.scheduledPerformDateTime
        ? new Date(task.scheduledPerformDateTime)
        : null;
    const validScheduledDate = scheduledDate && !Number.isNaN(scheduledDate.getTime())
        ? scheduledDate
        : null;
    const [scheduledDraft, setScheduledDraft] = useState<Date | null>(validScheduledDate);
    useEffect(() => {
        const nextDate = task.scheduledPerformDateTime
            ? new Date(task.scheduledPerformDateTime)
            : null;
        setScheduledDraft(nextDate && !Number.isNaN(nextDate.getTime()) ? nextDate : null);
    }, [task.taskId, task.scheduledPerformDateTime]);
    const displayedSubtasks = visibleSubtaskState.items;
    const displayedPomodoroStats = visiblePomodoroStatsState.stats;
    const taskCheckboxColor = PRIORITY_OPTIONS.find(
        option => option.label === getPriorityLabel(task.importance),
    )?.color ?? PRIORITY_OPTIONS[0].color;

    const handleDescriptionBlur = () => {
        if (visibleDescription !== taskDescription) {
            void onUpdate(task.taskId, { description: visibleDescription });
        }
    };

    const commitDateChange = async (date: Date | null) => {
        const scheduledPerformDateTime = formatTaskDateTime(date);
        await onUpdate(task.taskId, {
            scheduledPerformDateTime,
            ...(date ? {} : { reminderMinutesBefore: null }),
        });
        if (date && recurrenceDraftRef.current.recurrenceFrequency !== 'NONE'
            && !taskSeriesRef.current) {
            handleRecurrenceChange(recurrenceDraftRef.current, scheduledPerformDateTime);
        }
    };

    const handleDateChange = (date: Date | null) => {
        setScheduledDraft(date);
        if (!date) commitDateChange(null);
    };

    const scheduledPerformDateTime = formatTaskDateTime(scheduledDraft);
    const canStartRecurrence = Boolean(scheduledPerformDateTime);
    const showTimeOnlySchedule = canStartRecurrence
        && recurrenceDraft.recurrenceFrequency !== 'NONE';
    const handleRecurrenceChange = (
        nextDraft: TaskRecurrenceDraft,
        nextScheduledPerformDateTime = scheduledPerformDateTime,
    ) => {
        const previousDraft = recurrenceDraftRef.current;
        const requestId = recurrenceRequestIdRef.current + 1;
        recurrenceRequestIdRef.current = requestId;
        recurrenceDraftRef.current = nextDraft;
        setRecurrenceDraft(nextDraft);
        setRecurrenceError(null);

        const persist = async () => {
            if (requestId !== recurrenceRequestIdRef.current) return;
            const currentSeries = taskSeriesRef.current;

            if (nextDraft.recurrenceFrequency === 'NONE') {
                if (!currentSeries?.active) return;
                await taskService.stopTaskSeries(currentSeries.seriesId);
                taskSeriesRef.current = { ...currentSeries, active: false };
                if (requestId !== recurrenceRequestIdRef.current) return;
                void onRefreshTasks?.();
                return;
            }

            if (!nextScheduledPerformDateTime) return;
            const savedSeries = currentSeries
                ? await taskService.updateTaskSeries(currentSeries.seriesId, nextDraft, true)
                : await taskService.startTaskRecurrence(task.taskId, nextDraft);
            taskSeriesRef.current = savedSeries;
            if (requestId !== recurrenceRequestIdRef.current) return;
            void onRefreshTasks?.();
        };

        recurrenceMutationRef.current = recurrenceMutationRef.current
            .catch(() => undefined)
            .then(persist)
            .catch(error => {
                if (requestId !== recurrenceRequestIdRef.current) return;
                recurrenceDraftRef.current = previousDraft;
                setRecurrenceDraft(previousDraft);
                setRecurrenceError(error instanceof Error
                    ? error.message
                    : 'Unable to update recurrence.');
            });
    };

    const handleCreateSubtask = useCallback(async (name: string) => {
        const createdSubtask = await onCreateSubtask({
            name,
            description: '',
            scheduledPerformDateTime: '',
            tag: '',
            importance: 0,
            parentId: task.taskId,
        });
        setSubtaskState(previous => {
            if (previous.taskId !== task.taskId) return previous;
            const items = [...previous.items, createdSubtask];
            updateCachedTaskDetails(task.taskId, { subtasks: items }, {
                task,
                subtasks: items,
                taskSeries: taskSeriesRef.current,
            });
            return { ...previous, items };
        });
    }, [onCreateSubtask, task]);

    const handleToggleSubtask = useCallback(async (subtask: Task) => {
        const completed = !subtask.completed;
        const updateSubtask = (item: Task, nextCompleted: boolean) => (
            item.taskId === subtask.taskId ? { ...item, completed: nextCompleted } : item
        );
        setSubtaskState(previous => {
            if (previous.taskId !== task.taskId) return previous;
            const items = previous.items.map(item => updateSubtask(item, completed));
            updateCachedTaskDetails(task.taskId, { subtasks: items }, {
                task,
                subtasks: items,
                taskSeries: taskSeriesRef.current,
            });
            return { ...previous, items };
        });

        try {
            const updatedSubtask = await taskService.toggleTaskCompletion(subtask.taskId, completed);
            if (!subtask.completed && updatedSubtask.completed) playAudioFeedback('taskCompleted');
        } catch (error) {
            setSubtaskState(previous => {
                if (previous.taskId !== task.taskId) return previous;
                const items = previous.items.map(item => updateSubtask(item, subtask.completed));
                updateCachedTaskDetails(task.taskId, { subtasks: items }, {
                    task,
                    subtasks: items,
                    taskSeries: taskSeriesRef.current,
                });
                return { ...previous, items };
            });
            console.error('Error toggling subtask completion:', error);
        }
    }, [task]);

    return (
        <Box
            data-task-details="true"
            sx={{
                minHeight: { lg: 620 },
                p: { xs: 2, sm: 3, xl: 3.5 },
                borderRadius: 3,
                backgroundColor: 'background.paper',
                boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                containerType: 'inline-size',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
                <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ letterSpacing: '0.12em', fontWeight: 700 }}
                >
                    Task details
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.25, ml: 'auto' }}>
                    <IconButton
                        size="small"
                        color="error"
                        onClick={event => onDelete(task, event.currentTarget)}
                        aria-label={`Delete ${task.name}`}
                        title="Delete task"
                    >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={onClose} aria-label="Close task details">
                        <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 3, minWidth: 0 }}>
                <Checkbox
                    size="small"
                    checked={task.completed}
                    onChange={() => onToggleCompletion(task.taskId)}
                    sx={{
                        mt: -0.25,
                        color: taskCheckboxColor,
                        '&.Mui-checked': { color: taskCheckboxColor },
                    }}
                />
                <Typography
                    variant="h5"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        maxWidth: '100%',
                        maxHeight: '8rem',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        scrollbarGutter: 'stable',
                        fontSize: getTaskNameFontSize(task.name ?? ''),
                        textAlign: 'left',
                        lineHeight: 1.25,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        color: task.completed ? 'text.disabled' : 'text.primary',
                        textDecoration: task.completed ? 'line-through' : 'none',
                    }}
                >
                    {task.name}
                </Typography>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr)',
                    gap: 2.5,
                    alignItems: 'start',
                    '@container (min-width: 680px)': {
                        gridTemplateColumns: 'minmax(0, 1.08fr) minmax(280px, 0.92fr)',
                        gap: 4,
                    },
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                            Priority
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75 }}>
                            {PRIORITY_OPTIONS.map(option => {
                                const selected = getPriorityLabel(task.importance) === option.label;
                                return (
                                    <Chip
                                        key={option.label}
                                        data-task-details-first-focus={option === PRIORITY_OPTIONS[0] ? 'true' : undefined}
                                        label={option.label}
                                        size="small"
                                        onClick={() => void onUpdate(task.taskId, { importance: option.value })}
                                        sx={{
                                            border: `1px solid ${option.color}`,
                                            color: selected ? '#fff' : option.color,
                                            backgroundColor: selected ? option.color : 'transparent',
                                            fontWeight: selected ? 600 : 400,
                                            cursor: 'pointer',
                                        }}
                                    />
                                );
                            })}
                        </Box>
                    </Box>

                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <Box onClick={event => event.stopPropagation()}>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: task.parentId
                                        ? 'minmax(0, 1fr)'
                                        : { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 3fr) minmax(0, 1fr)' },
                                    gap: 1.25,
                                    alignItems: 'start',
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Collapse in={showTimeOnlySchedule} timeout={180} unmountOnExit>
                                        <TimePicker
                                            label="Scheduled"
                                            value={scheduledDraft}
                                            onChange={handleDateChange}
                                            onAccept={commitDateChange}
                                            ampm={false}
                                            slotProps={{
                                                field: { clearable: false },
                                                actionBar: { actions: ['cancel', 'accept'] },
                                                textField: { size: 'small', fullWidth: true },
                                            }}
                                        />
                                    </Collapse>
                                    <Collapse in={!showTimeOnlySchedule} timeout={180} unmountOnExit>
                                        <DateTimePicker
                                            label="Scheduled"
                                            value={scheduledDraft}
                                            onChange={handleDateChange}
                                            onAccept={commitDateChange}
                                            closeOnSelect={false}
                                            ampm={false}
                                            slotProps={{
                                                field: { clearable: true },
                                                actionBar: { actions: ['cancel', 'accept'] },
                                                textField: { size: 'small', fullWidth: true },
                                            }}
                                        />
                                    </Collapse>
                                </Box>

                                {!task.parentId && (
                                    <TaskRecurrencePicker
                                        value={recurrenceDraft}
                                        onChange={handleRecurrenceChange}
                                        showEndDate={false}
                                        showCustomOptions={false}
                                    />
                                )}
                            </Box>
                            {!task.parentId && (
                                <Collapse in={recurrenceDraft.recurrenceFrequency !== 'NONE'} timeout={180} unmountOnExit>
                                    <Box sx={{
                                        mt: 1.25,
                                        display: 'grid',
                                        gridTemplateColumns: recurrenceDraft.recurrenceFrequency === 'CUSTOM'
                                            ? { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }
                                            : 'minmax(0, 1fr)',
                                        gap: 1.25,
                                        alignItems: 'start',
                                    }}>
                                        {recurrenceDraft.recurrenceFrequency === 'CUSTOM' && (
                                            <TaskRecurrenceCustomOptions
                                                value={recurrenceDraft}
                                                onChange={handleRecurrenceChange}
                                            />
                                        )}
                                        <AppDateField
                                            label="Repeat until (optional)"
                                            value={recurrenceDraft.recurrenceEndDate ?? ''}
                                            onChange={recurrenceEndDate => handleRecurrenceChange({
                                                ...recurrenceDraft,
                                                recurrenceEndDate: recurrenceEndDate || null,
                                            })}
                                        />
                                    </Box>
                                </Collapse>
                            )}
                            {recurrenceError && (
                                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                                    {recurrenceError}
                                </Typography>
                            )}
                            <TaskReminderPicker
                                value={task.reminderMinutesBefore}
                                disabled={!scheduledPerformDateTime}
                                onChange={reminderMinutesBefore => void onUpdate(task.taskId, { reminderMinutesBefore })}
                            />
                        </Box>
                    </LocalizationProvider>

                    <TextField
                        label="Description"
                        autoComplete="off"
                        value={visibleDescription}
                        onChange={event => setDescriptionDraft({
                            taskId: task.taskId,
                            source: taskDescription,
                            value: event.target.value,
                        })}
                        onBlur={handleDescriptionBlur}
                        multiline
                        minRows={2}
                        maxRows={5}
                        size="small"
                        fullWidth
                        placeholder="Add a note"
                    />

                    {task.tag && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Tag
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, textAlign: 'left' }}>
                                {task.tag}
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Subtasks {displayedSubtasks.length > 0 ? `· ${displayedSubtasks.filter(subtask => subtask.completed).length}/${displayedSubtasks.length}` : ''}
                        </Typography>
                        <SubtaskList items={displayedSubtasks} onToggle={handleToggleSubtask} />
                        {!visibleSubtaskState.loading && (
                            <SubtaskComposer taskId={task.taskId} onSubmit={handleCreateSubtask} />
                        )}
                    </Box>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        minWidth: 0,
                        pt: 2.5,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        '@container (min-width: 680px)': {
                            pt: 0,
                            pl: 4,
                            borderTop: 0,
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                        },
                    }}
                >
                    <Box sx={{ minHeight: 178 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            Focus history
                        </Typography>
                        <Box
                            aria-busy={visiblePomodoroStatsState.loading && !displayedPomodoroStats}
                            sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}
                        >
                            <FocusStat
                                label="Focus time"
                                value={displayedPomodoroStats ? formatFocusTime(displayedPomodoroStats.totalFocusSeconds) : '—'}
                            />
                            <FocusStat label="Days worked" value={displayedPomodoroStats?.totalDaysWorked ?? '—'} />
                            <FocusStat
                                label="Current streak"
                                value={displayedPomodoroStats ? `${displayedPomodoroStats.currentStreakDays}d` : '—'}
                            />
                            <FocusStat
                                label="Best streak"
                                value={displayedPomodoroStats ? `${displayedPomodoroStats.longestStreakDays}d` : '—'}
                            />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {visiblePomodoroStatsState.error && !displayedPomodoroStats
                                ? 'Focus history is unavailable right now.'
                                : displayedPomodoroStats?.lastWorkedOnDate
                                    ? `Last worked ${formatWorkedDate(displayedPomodoroStats.lastWorkedOnDate)}`
                                    : !displayedPomodoroStats
                                        ? 'Loading focus history…'
                                        : null}
                        </Typography>
                    </Box>

                </Box>
            </Box>
        </Box>
    );
});
