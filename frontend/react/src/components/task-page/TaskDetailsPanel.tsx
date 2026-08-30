import React, { useEffect, useState } from 'react';
import {
    Box,
    Chip,
    Checkbox,
    IconButton,
    TextField,
    Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Task } from '../../types/Task.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';
import { TaskPomodoroStats } from '../../types/TaskPomodoroStats';
import { taskService } from '../../services/api';

type TaskDetailsPanelProps = {
    task: Task;
    onClose: () => void;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
    onToggleCompletion: (taskId: string) => void;
    onDelete: (task: Task, anchorEl: HTMLElement) => void;
    onCreateSubtask: (task: TaskToCreate) => Promise<Task>;
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

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

const subtaskCache = new Map<string, Task[]>();
const pomodoroStatsCache = new Map<string, TaskPomodoroStats>();

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
                onChange={event => setDraft({ taskId, name: event.target.value, focused: visibleDraft.focused })}
                onFocus={() => setDraft({ ...visibleDraft, focused: true })}
                onBlur={() => setDraft({ ...visibleDraft, focused: false })}
                placeholder="Add a subtask"
                variant="standard"
                fullWidth
                InputProps={{ disableUnderline: true }}
                sx={{ '& .MuiInputBase-input': { py: 1.25 } }}
            />
        </Box>
    );
});

export const TaskDetailsPanel = React.memo(function TaskDetailsPanel({
    task,
    onClose,
    onUpdate,
    onToggleCompletion,
    onDelete,
    onCreateSubtask,
}: TaskDetailsPanelProps) {
    const taskDescription = task.description ?? '';
    const [descriptionDraft, setDescriptionDraft] = useState<DescriptionDraft>({
        taskId: task.taskId,
        source: taskDescription,
        value: taskDescription,
    });
    const visibleDescription = descriptionDraft.taskId === task.taskId
        && descriptionDraft.source === taskDescription
        ? descriptionDraft.value
        : taskDescription;
    const initialSubtasks = subtaskCache.get(task.taskId);
    const [subtaskState, setSubtaskState] = useState<SubtaskState>({
        taskId: task.taskId,
        items: initialSubtasks ?? [],
        loading: !initialSubtasks,
    });
    const cachedSubtasks = subtaskCache.get(task.taskId);
    const visibleSubtaskState = subtaskState.taskId === task.taskId
        ? subtaskState
        : {
            taskId: task.taskId,
            items: cachedSubtasks ?? [],
            loading: !cachedSubtasks,
        };
    const initialPomodoroStats = pomodoroStatsCache.get(task.taskId) ?? null;
    const [pomodoroStatsState, setPomodoroStatsState] = useState<PomodoroStatsState>({
        taskId: task.taskId,
        stats: initialPomodoroStats,
        loading: !initialPomodoroStats,
        error: false,
    });
    const cachedPomodoroStats = pomodoroStatsCache.get(task.taskId) ?? null;
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
        const cached = subtaskCache.get(task.taskId);
        setSubtaskState({
            taskId: task.taskId,
            items: cached ?? [],
            loading: !cached,
        });
        taskService.getSubtasks(task.taskId)
            .then(nextSubtasks => {
                if (!cancelled) {
                    subtaskCache.set(task.taskId, nextSubtasks);
                    setSubtaskState({ taskId: task.taskId, items: nextSubtasks, loading: false });
                }
            })
            .catch(error => {
                if (!cancelled) {
                    setSubtaskState({ taskId: task.taskId, items: cached ?? [], loading: false });
                    console.error('Error fetching subtasks for task details:', error);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [task.taskId]);

    useEffect(() => {
        const controller = new AbortController();
        const cached = pomodoroStatsCache.get(task.taskId) ?? null;
        setPomodoroStatsState({
            taskId: task.taskId,
            stats: cached,
            loading: !cached,
            error: false,
        });

        const loadStats = async () => {
            try {
                const nextStats = await taskService.getPomodoroStats(task.taskId, controller.signal);
                if (!controller.signal.aborted) {
                    pomodoroStatsCache.set(task.taskId, nextStats);
                    setPomodoroStatsState({
                        taskId: task.taskId,
                        stats: nextStats,
                        loading: false,
                        error: false,
                    });
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setPomodoroStatsState({
                        taskId: task.taskId,
                        stats: pomodoroStatsCache.get(task.taskId) ?? null,
                        loading: false,
                        error: true,
                    });
                    console.error('Error fetching Pomodoro stats for task details:', error);
                }
            }
        };

        void loadStats();
        const refreshInterval = window.setInterval(() => void loadStats(), 15000);
        return () => {
            controller.abort();
            window.clearInterval(refreshInterval);
        };
    }, [task.taskId]);

    const scheduledDate = task.scheduledPerformDateTime
        ? new Date(task.scheduledPerformDateTime)
        : null;
    const validScheduledDate = scheduledDate && !Number.isNaN(scheduledDate.getTime())
        ? scheduledDate
        : null;
    const displayedSubtasks = visibleSubtaskState.items;
    const displayedPomodoroStats = visiblePomodoroStatsState.stats;

    const handleDescriptionBlur = () => {
        if (visibleDescription !== taskDescription) {
            void onUpdate(task.taskId, { description: visibleDescription });
        }
    };

    const handleDateChange = (date: Date | null) => {
        void onUpdate(task.taskId, { scheduledPerformDateTime: formatTaskDateTime(date) });
    };

    const handleCreateSubtask = async (name: string) => {
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
            subtaskCache.set(task.taskId, items);
            return { ...previous, items };
        });
    };

    const handleToggleSubtask = async (subtask: Task) => {
        const completed = !subtask.completed;
        const updateSubtask = (item: Task, nextCompleted: boolean) => (
            item.taskId === subtask.taskId ? { ...item, completed: nextCompleted } : item
        );
        setSubtaskState(previous => {
            if (previous.taskId !== task.taskId) return previous;
            const items = previous.items.map(item => updateSubtask(item, completed));
            subtaskCache.set(task.taskId, items);
            return { ...previous, items };
        });

        try {
            await taskService.toggleTaskCompletion(subtask.taskId, completed);
        } catch (error) {
            setSubtaskState(previous => {
                if (previous.taskId !== task.taskId) return previous;
                const items = previous.items.map(item => updateSubtask(item, subtask.completed));
                subtaskCache.set(task.taskId, items);
                return { ...previous, items };
            });
            console.error('Error toggling subtask completion:', error);
        }
    };

    return (
        <Box
            data-task-details="true"
            sx={{
                minHeight: { lg: 620 },
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                backgroundColor: 'background.paper',
                boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
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

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 3 }}>
                <Checkbox
                    size="small"
                    checked={task.completed}
                    onChange={() => onToggleCompletion(task.taskId)}
                    sx={{ mt: -0.25 }}
                />
                <Typography
                    variant="h5"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        lineHeight: 1.25,
                        color: task.completed ? 'text.disabled' : 'text.primary',
                        textDecoration: task.completed ? 'line-through' : 'none',
                    }}
                >
                    {task.name}
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                        Priority
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                        {PRIORITY_OPTIONS.map(option => {
                            const selected = getPriorityLabel(task.importance) === option.label;
                            return (
                                <Chip
                                    key={option.label}
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
                    <DateTimePicker
                        label="Scheduled"
                        value={validScheduledDate}
                        onChange={handleDateChange}
                        ampm={false}
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                </LocalizationProvider>

                <TextField
                    label="Description"
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

                <Box sx={{ pt: 2.5, minHeight: 178, borderTop: '1px solid', borderColor: 'divider' }}>
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
                        <FocusStat label="Focus sessions" value={displayedPomodoroStats?.totalFocusSessions ?? '—'} />
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

                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Subtasks {displayedSubtasks.length > 0 ? `· ${displayedSubtasks.filter(subtask => subtask.completed).length}/${displayedSubtasks.length}` : ''}
                    </Typography>
                    {displayedSubtasks.map(subtask => (
                        <Box key={subtask.taskId} sx={{ display: 'flex', alignItems: 'center', minHeight: 38 }}>
                            <Checkbox
                                size="small"
                                checked={subtask.completed}
                                onChange={() => void handleToggleSubtask(subtask)}
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
                    {!visibleSubtaskState.loading && (
                        <SubtaskComposer taskId={task.taskId} onSubmit={handleCreateSubtask} />
                    )}
                </Box>
            </Box>
        </Box>
    );
});
