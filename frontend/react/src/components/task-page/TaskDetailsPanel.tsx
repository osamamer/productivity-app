import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Box,
    Chip,
    Checkbox,
    Collapse,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Project } from '../../types/Project';
import { Task } from '../../types/Task.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';
import { TaskSeries } from '../../types/TaskSeries';
import { defaultTaskRecurrence, TaskRecurrenceDraft } from '../../types/TaskRecurrence';
import { TaskPomodoroStats } from '../../types/TaskPomodoroStats';
import { taskService } from '../../services/api';
import { projectService } from '../../services/api/projectService';
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
    getCachedTaskDetails,
    getStaleTaskDetails,
    setCachedTaskDetails,
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
    onDelete: (subtask: Task) => void;
    onUpdateName: (subtask: Task, name: string) => Promise<void>;
};

type SubtaskContextMenuState = {
    subtask: Task;
    top: number;
    left: number;
};

type ProjectsState = {
    projects: Project[];
    loading: boolean;
    error: boolean;
};

type ProjectSelection = {
    taskId: string;
    projectId: string | null;
};

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

const EMPTY_SUBTASKS: Task[] = [];
const EMPTY_PROJECTS: Project[] = [];
const TASK_NAME_SCALE_START = 48;
const TASK_NAME_SCALE_END = 240;

function sortSubtasks(items: Task[]): Task[] {
    return [...items].sort((first, second) => {
        const firstCreated = Date.parse(first.creationDateTime);
        const secondCreated = Date.parse(second.creationDateTime);
        if (Number.isFinite(firstCreated) && Number.isFinite(secondCreated)
            && firstCreated !== secondCreated) {
            return firstCreated - secondCreated;
        }
        if (first.displayOrder !== second.displayOrder) {
            return first.displayOrder - second.displayOrder;
        }
        return first.taskId.localeCompare(second.taskId);
    });
}

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
    composerRef,
}: {
    taskId: string;
    onSubmit: (name: string) => Promise<void>;
    composerRef?: React.Ref<HTMLFormElement>;
}) {
    const [draft, setDraft] = useState({ taskId, name: '', focused: false });
    const submittingDraftsRef = useRef(new Set<string>());
    const visibleDraft = draft.taskId === taskId
        ? draft
        : { taskId, name: '', focused: false };

    const submitDraft = async (submittedDraft: typeof visibleDraft) => {
        const trimmedName = submittedDraft.name.trim();
        if (!trimmedName) return;
        const requestKey = `${submittedDraft.taskId}\0${trimmedName}`;
        if (submittingDraftsRef.current.has(requestKey)) return;
        submittingDraftsRef.current.add(requestKey);

        try {
            await onSubmit(trimmedName);
            setDraft(previous => previous.taskId === submittedDraft.taskId
                && previous.name.trim() === trimmedName
                ? { ...previous, name: '' }
                : previous);
        } catch (error) {
            console.error('Error creating task-page subtask:', error);
        } finally {
            submittingDraftsRef.current.delete(requestKey);
        }
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submitDraft(visibleDraft);
    };

    return (
        <Box
            component="form"
            ref={composerRef}
            onSubmit={submit}
            sx={{
                display: 'flex',
                alignItems: 'center',
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
                onBlur={() => {
                    setDraft({ ...visibleDraft, focused: false });
                    void submitDraft(visibleDraft);
                }}
                placeholder="Add a subtask"
                variant="standard"
                fullWidth
                InputProps={{ disableUnderline: true }}
                sx={{ '& .MuiInputBase-input': { py: 1.25, fontSize: '0.875rem' } }}
            />
        </Box>
    );
});

const SubtaskList = React.memo(function SubtaskList({
    items,
    onToggle,
    onDelete,
    onUpdateName,
}: SubtaskListProps) {
    const [contextMenu, setContextMenu] = useState<SubtaskContextMenuState | null>(null);
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [localSubtaskName, setLocalSubtaskName] = useState('');
    const subtaskNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const subtaskCommitRef = useRef<string | null>(null);
    const subtaskPointerDownRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (contextMenu && !items.some(item => item.taskId === contextMenu.subtask.taskId)) {
            setContextMenu(null);
        }
    }, [contextMenu, items]);

    useEffect(() => {
        if (!editingSubtaskId || !subtaskNameInputRef.current) return;

        const input = subtaskNameInputRef.current;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, [editingSubtaskId]);

    useEffect(() => {
        if (editingSubtaskId && !items.some(item => item.taskId === editingSubtaskId)) {
            setEditingSubtaskId(null);
            setLocalSubtaskName('');
        }
    }, [editingSubtaskId, items]);

    const startEditing = (subtask: Task) => {
        subtaskCommitRef.current = null;
        setContextMenu(null);
        setEditingSubtaskId(subtask.taskId);
        setLocalSubtaskName(subtask.name);
    };

    const commitName = async (subtask: Task) => {
        if (subtaskCommitRef.current === subtask.taskId) return;

        subtaskCommitRef.current = subtask.taskId;
        const trimmedName = localSubtaskName.trim();
        const fallbackName = subtask.name;
        setEditingSubtaskId(null);
        setLocalSubtaskName(trimmedName || fallbackName);

        if (!trimmedName || trimmedName === fallbackName) return;
        await onUpdateName(subtask, trimmedName);
    };

    const cancelNameEdit = (subtask: Task) => {
        subtaskCommitRef.current = subtask.taskId;
        setLocalSubtaskName(subtask.name);
        setEditingSubtaskId(null);
    };

    return (
        <Box
            sx={{ minWidth: 0 }}
        >
            {items.map(subtask => {
                const isEditing = editingSubtaskId === subtask.taskId;
                return (
                    <Box
                        key={subtask.taskId}
                        onContextMenu={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            setContextMenu({
                                subtask,
                                top: event.clientY,
                                left: event.clientX,
                            });
                        }}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 38,
                            borderRadius: 1,
                            '&:hover': { backgroundColor: 'action.hover' },
                        }}
                    >
                        <Checkbox
                            size="small"
                            checked={subtask.completed}
                            onChange={() => void onToggle(subtask)}
                            sx={{ p: 0.5, mr: 0.75 }}
                        />
                        <Box
                            data-subtask-text="true"
                            onMouseDown={event => {
                                if (event.button === 0) {
                                    subtaskPointerDownRef.current = { x: event.clientX, y: event.clientY };
                                }
                            }}
                            onClick={event => {
                                event.stopPropagation();
                                if (isEditing) return;

                                const pointerDown = subtaskPointerDownRef.current;
                                subtaskPointerDownRef.current = null;
                                const moved = pointerDown !== null
                                    && (Math.abs(event.clientX - pointerDown.x) > 4
                                        || Math.abs(event.clientY - pointerDown.y) > 4);
                                const selection = window.getSelection();
                                if (moved || (selection && !selection.isCollapsed)) return;

                                startEditing(subtask);
                            }}
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                py: 0.5,
                                textAlign: 'left',
                                userSelect: 'text',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                                cursor: 'text',
                            }}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Typography
                                    component="span"
                                    sx={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        textAlign: 'left',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: 1.45,
                                        maxHeight: '4.35em',
                                        overflowY: 'auto',
                                        overflowX: 'hidden',
                                        color: subtask.completed ? 'text.disabled' : 'text.primary',
                                        textDecoration: subtask.completed ? 'line-through' : 'none',
                                        visibility: isEditing ? 'hidden' : 'visible',
                                    }}
                                >
                                    {subtask.name}
                                </Typography>
                                {isEditing && (
                                    <TextField
                                        value={localSubtaskName}
                                        inputRef={subtaskNameInputRef}
                                        autoComplete="off"
                                        autoFocus
                                        fullWidth
                                        multiline
                                        minRows={1}
                                        maxRows={3}
                                        variant="standard"
                                        onClick={event => event.stopPropagation()}
                                        onDoubleClick={event => event.stopPropagation()}
                                        onChange={event => setLocalSubtaskName(event.target.value)}
                                        onBlur={() => void commitName(subtask)}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                void commitName(subtask);
                                            }
                                            if (event.key === 'Escape') {
                                                event.preventDefault();
                                                cancelNameEdit(subtask);
                                            }
                                        }}
                                        InputProps={{ disableUnderline: true }}
                                        sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            '& .MuiInputBase-root': { height: '100%', padding: 0 },
                                            '& .MuiInputBase-input': {
                                                color: subtask.completed ? 'text.disabled' : 'text.primary',
                                                textDecoration: subtask.completed ? 'line-through' : 'none',
                                                fontSize: '0.875rem',
                                                lineHeight: 1.45,
                                                whiteSpace: 'pre-wrap',
                                                overflowWrap: 'anywhere',
                                                wordBreak: 'break-word',
                                                textAlign: 'left',
                                                padding: 0,
                                            },
                                        }}
                                        inputProps={{
                                            draggable: false,
                                            'data-subtask-name-input': 'true',
                                            'aria-label': `Edit subtask ${subtask.name}`,
                                        }}
                                    />
                                )}
                            </Box>
                        </Box>
                    </Box>
                );
            })}
            <Menu
                open={contextMenu !== null}
                onClose={() => setContextMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={contextMenu
                    ? { top: contextMenu.top, left: contextMenu.left }
                    : undefined}
                MenuListProps={{
                    dense: true,
                    onClick: event => event.stopPropagation(),
                }}
            >
                {contextMenu && (
                    <MenuItem
                        onClick={event => {
                            event.stopPropagation();
                            const subtask = contextMenu.subtask;
                            setContextMenu(null);
                            onDelete(subtask);
                        }}
                        sx={{ color: 'error.main' }}
                    >
                        <ListItemIcon sx={{ color: 'inherit' }}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Delete subtask</ListItemText>
                    </MenuItem>
                )}
            </Menu>
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
    const [subtaskError, setSubtaskError] = useState<string | null>(null);
    const [projectsState, setProjectsState] = useState<ProjectsState>(() => {
        const cachedProjects = projectService.getCachedProjects();
        return {
            projects: cachedProjects ?? EMPTY_PROJECTS,
            loading: !cachedProjects,
            error: false,
        };
    });
    const [projectMenuAnchorEl, setProjectMenuAnchorEl] = useState<HTMLElement | null>(null);
    const [projectSelection, setProjectSelection] = useState<ProjectSelection | null>(null);
    const projectLoadRequestRef = useRef(0);
    const projectSelectionRequestRef = useRef(0);
    const projectMutationRef = useRef<Promise<void>>(Promise.resolve());
    const recurrenceDraftRef = useRef<TaskRecurrenceDraft>(
        recurrenceDraftFromSeries(initialTaskDetails?.taskSeries),
    );
    const taskSeriesRef = useRef<TaskSeries | null>(initialTaskDetails?.taskSeries ?? null);
    const recurrenceMutationRef = useRef<Promise<void>>(Promise.resolve());
    const recurrenceRequestIdRef = useRef(0);
    const subtaskNameRequestIdsRef = useRef(new Map<string, number>());
    const [localTaskName, setLocalTaskName] = useState(task.name ?? '');
    const [editingTaskName, setEditingTaskName] = useState(false);
    const taskNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const taskNameCommitRef = useRef(false);
    const visibleDescription = descriptionDraft.taskId === task.taskId
        && descriptionDraft.source === taskDescription
        ? descriptionDraft.value
        : taskDescription;

    useEffect(() => {
        setLocalTaskName(task.name ?? '');
        setEditingTaskName(false);
    }, [task.taskId, task.name]);

    useEffect(() => {
        if (!editingTaskName || !taskNameInputRef.current) return;
        const input = taskNameInputRef.current;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, [editingTaskName]);

    const refreshProjects = useCallback(() => {
        const requestId = projectLoadRequestRef.current + 1;
        projectLoadRequestRef.current = requestId;

        const cachedProjects = projectService.getCachedProjects();
        if (cachedProjects) {
            setProjectsState(previous => (
                previous.projects === cachedProjects && !previous.loading && !previous.error
                    ? previous
                    : { projects: cachedProjects, loading: false, error: false }
            ));
        } else {
            setProjectsState(previous => (
                previous.projects.length === 0 && !previous.loading
                    ? { ...previous, loading: true }
                    : previous
            ));
        }

        void projectService.getProjects()
            .then(projects => {
                if (projectLoadRequestRef.current !== requestId) return;
                setProjectsState({ projects, loading: false, error: false });
            })
            .catch(error => {
                if (projectLoadRequestRef.current !== requestId) return;
                setProjectsState(previous => ({ ...previous, loading: false, error: true }));
                console.error('Error fetching projects for task details:', error);
            });
    }, []);

    useEffect(() => {
        refreshProjects();
        return () => {
            projectLoadRequestRef.current += 1;
        };
    }, [refreshProjects]);

    useEffect(() => {
        setProjectSelection(null);
    }, [task.taskId]);
    const [subtaskState, setSubtaskState] = useState<SubtaskState>({
        taskId: task.taskId,
        items: sortSubtasks(initialTaskDetails?.subtasks ?? EMPTY_SUBTASKS),
        loading: !initialTaskDetails,
    });
    const cachedTaskDetails = getStaleTaskDetails(task.taskId);
    const visibleSubtaskState = subtaskState.taskId === task.taskId
        ? subtaskState
        : {
            taskId: task.taskId,
            items: sortSubtasks(cachedTaskDetails?.subtasks ?? EMPTY_SUBTASKS),
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
        const fresh = getCachedTaskDetails(taskId);
        const cached = getStaleTaskDetails(taskId);
        let loadedSubtasks = sortSubtasks(fresh?.subtasks ?? cached?.subtasks ?? EMPTY_SUBTASKS);
        let loadedSeries = fresh?.taskSeries ?? cached?.taskSeries ?? null;
        let subtasksLoaded = Boolean(fresh);
        let seriesLoaded = Boolean(fresh) || !task.taskSeriesId;

        const cacheCompleteDetails = () => {
            if (!subtasksLoaded || !seriesLoaded) return;
            setCachedTaskDetails(taskId, {
                task,
                subtasks: loadedSubtasks,
                taskSeries: loadedSeries,
            });
        };

        setRecurrenceError(null);
        setSubtaskError(null);
        if (cached) {
            const nextDraft = recurrenceDraftFromSeries(cached.taskSeries);
            taskSeriesRef.current = cached.taskSeries;
            recurrenceDraftRef.current = nextDraft;
            setRecurrenceDraft(nextDraft);
            setSubtaskState({ taskId, items: sortSubtasks(cached.subtasks), loading: !fresh });
        } else {
            taskSeriesRef.current = null;
            recurrenceDraftRef.current = defaultTaskRecurrence();
            setRecurrenceDraft(recurrenceDraftRef.current);
            setSubtaskState({ taskId, items: EMPTY_SUBTASKS, loading: true });
        }

        if (fresh) {
            return () => {
                cancelled = true;
            };
        }

        void taskService.getSubtasks(taskId)
            .then(subtasks => {
                if (cancelled) return;
                loadedSubtasks = sortSubtasks(subtasks);
                subtasksLoaded = true;
                setSubtaskState(previous => {
                    const items = previous.taskId === taskId
                        && areSubtasksEqual(previous.items, loadedSubtasks)
                        ? previous.items
                        : loadedSubtasks;
                    return { taskId, items, loading: false };
                });
                cacheCompleteDetails();
            })
            .catch(error => {
                if (cancelled) return;
                setSubtaskState(previous => ({
                    taskId,
                    items: previous.taskId === taskId ? previous.items : cached?.subtasks ?? EMPTY_SUBTASKS,
                    loading: false,
                }));
                setSubtaskError('Unable to load subtasks.');
                console.error('Error fetching task subtasks:', error);
            });

        const taskSeriesPromise = task.taskSeriesId
            ? taskService.getTaskSeries(taskId, task.taskSeriesId)
            : Promise.resolve(null);
        void taskSeriesPromise
            .then(series => {
                if (cancelled) return;
                loadedSeries = series;
                seriesLoaded = true;
                const nextDraft = recurrenceDraftFromSeries(series);
                taskSeriesRef.current = series;
                recurrenceDraftRef.current = nextDraft;
                setRecurrenceDraft(nextDraft);
                cacheCompleteDetails();
            })
            .catch(error => {
                if (cancelled) return;
                setRecurrenceError('Unable to load recurrence.');
                console.error('Error fetching task recurrence:', error);
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
    const subtaskComposerRef = useRef<HTMLFormElement | null>(null);
    const revealSubtaskComposerRef = useRef(false);
    useEffect(() => {
        const nextDate = task.scheduledPerformDateTime
            ? new Date(task.scheduledPerformDateTime)
            : null;
        setScheduledDraft(nextDate && !Number.isNaN(nextDate.getTime()) ? nextDate : null);
    }, [task.taskId, task.scheduledPerformDateTime]);
    const displayedSubtasks = visibleSubtaskState.items;
    const displayedPomodoroStats = visiblePomodoroStatsState.stats;
    const effectiveProjectId = projectSelection?.taskId === task.taskId
        ? projectSelection.projectId
        : task.projectId ?? null;
    const effectiveProject = effectiveProjectId
        ? projectsState.projects.find(project => project.projectId === effectiveProjectId) ?? null
        : null;
    const projectLabel = effectiveProjectId === null
        ? 'No project'
        : effectiveProject?.name
            ?? (projectsState.loading ? 'Loading project…' : 'Project unavailable');

    useLayoutEffect(() => {
        if (!revealSubtaskComposerRef.current || !subtaskComposerRef.current) return;

        revealSubtaskComposerRef.current = false;
        subtaskComposerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [displayedSubtasks.length]);

    const taskCheckboxColor = PRIORITY_OPTIONS.find(
        option => option.label === getPriorityLabel(task.importance),
    )?.color ?? PRIORITY_OPTIONS[0].color;

    const openProjectMenu = (event: React.MouseEvent<HTMLElement>) => {
        setProjectMenuAnchorEl(event.currentTarget);
        refreshProjects();
    };

    const closeProjectMenu = () => {
        setProjectMenuAnchorEl(null);
    };

    const selectProject = (projectId: string | null) => {
        closeProjectMenu();
        if (projectId === effectiveProjectId) return;

        const requestId = projectSelectionRequestRef.current + 1;
        projectSelectionRequestRef.current = requestId;
        setProjectSelection({ taskId: task.taskId, projectId });
        // Serialize patches so an older failure cannot roll back a newer selection.
        projectMutationRef.current = projectMutationRef.current
            .catch(() => undefined)
            .then(() => onUpdate(task.taskId, { projectId }))
            .catch(error => {
                console.error('Error updating task project:', error);
            })
            .finally(() => {
                if (projectSelectionRequestRef.current !== requestId) return;
                setProjectSelection(current => (
                    current?.taskId === task.taskId && current.projectId === projectId
                        ? null
                        : current
                ));
            });
    };

    const handleDescriptionBlur = () => {
        if (visibleDescription !== taskDescription) {
            void onUpdate(task.taskId, { description: visibleDescription });
        }
    };

    const startTaskNameEditing = () => {
        taskNameCommitRef.current = false;
        setLocalTaskName(task.name ?? '');
        setEditingTaskName(true);
    };

    const commitTaskName = () => {
        if (taskNameCommitRef.current) return;
        taskNameCommitRef.current = true;

        const trimmedName = localTaskName.trim();
        const fallbackName = task.name ?? '';
        setEditingTaskName(false);
        setLocalTaskName(trimmedName || fallbackName);
        if (trimmedName && trimmedName !== fallbackName) {
            void onUpdate(task.taskId, { name: trimmedName });
        }
    };

    const cancelTaskNameEdit = () => {
        taskNameCommitRef.current = true;
        setLocalTaskName(task.name ?? '');
        setEditingTaskName(false);
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
        revealSubtaskComposerRef.current = true;
        setSubtaskState(previous => {
            if (previous.taskId !== task.taskId) return previous;
            const items = sortSubtasks([...previous.items, createdSubtask]);
            updateCachedTaskDetails(task.taskId, { subtasks: items }, {
                task,
                subtasks: items,
                taskSeries: taskSeriesRef.current,
            });
            return { ...previous, items };
        });
    }, [onCreateSubtask, task]);

    const handleDeleteSubtask = useCallback(async (subtask: Task) => {
        setSubtaskState(previous => {
            if (previous.taskId !== task.taskId) return previous;
            const items = previous.items.filter(item => item.taskId !== subtask.taskId);
            updateCachedTaskDetails(task.taskId, { subtasks: items }, {
                task,
                subtasks: items,
                taskSeries: taskSeriesRef.current,
            });
            return { ...previous, items };
        });

        try {
            // A subtask is not part of the main-task list. Avoid invalidating
            // that list while the details panel is applying its optimistic
            // update, which would briefly remount the surrounding panel.
            await taskService.deleteTaskInstance(subtask, { notifyResource: false });
        } catch (error) {
            setSubtaskState(previous => {
                if (previous.taskId !== task.taskId
                    || previous.items.some(item => item.taskId === subtask.taskId)) {
                    return previous;
                }
                const items = sortSubtasks([...previous.items, subtask]);
                updateCachedTaskDetails(task.taskId, { subtasks: items }, {
                    task,
                    subtasks: items,
                    taskSeries: taskSeriesRef.current,
                });
                return { ...previous, items };
            });
            console.error('Error deleting subtask:', error);
        }
    }, [task]);

    const handleUpdateSubtaskName = useCallback(async (subtask: Task, name: string) => {
        const requestId = (subtaskNameRequestIdsRef.current.get(subtask.taskId) ?? 0) + 1;
        subtaskNameRequestIdsRef.current.set(subtask.taskId, requestId);
        setSubtaskError(null);

        const updateVisibleName = (nextName: string) => {
            setSubtaskState(previous => {
                if (previous.taskId !== task.taskId) return previous;
                const items = previous.items.map(item => item.taskId === subtask.taskId
                    ? { ...item, name: nextName }
                    : item);
                updateCachedTaskDetails(task.taskId, { subtasks: items }, {
                    task,
                    subtasks: items,
                    taskSeries: taskSeriesRef.current,
                });
                return { ...previous, items };
            });
        };

        updateVisibleName(name);
        try {
            const updatedSubtask = await taskService.updateTask(subtask.taskId, { name });
            if (subtaskNameRequestIdsRef.current.get(subtask.taskId) !== requestId) return;
            updateVisibleName(updatedSubtask.name);
        } catch (error) {
            if (subtaskNameRequestIdsRef.current.get(subtask.taskId) !== requestId) return;
            updateVisibleName(subtask.name);
            setSubtaskError('Unable to update subtask.');
            console.error('Error updating subtask name:', error);
        }
    }, [task]);

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
                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        maxWidth: '100%',
                        maxHeight: '8rem',
                        overflowY: editingTaskName ? 'hidden' : 'auto',
                        overflowX: 'hidden',
                        scrollbarGutter: 'stable',
                    }}
                >
                    {editingTaskName ? (
                        <TextField
                            value={localTaskName}
                            inputRef={taskNameInputRef}
                            autoComplete="off"
                            autoFocus
                            fullWidth
                            multiline
                            minRows={1}
                            maxRows={5}
                            variant="standard"
                            onClick={event => event.stopPropagation()}
                            onChange={event => setLocalTaskName(event.target.value)}
                            onBlur={commitTaskName}
                            onKeyDown={event => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    commitTaskName();
                                }
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelTaskNameEdit();
                                }
                            }}
                            InputProps={{ disableUnderline: true }}
                            inputProps={{
                                draggable: false,
                                'data-task-name-input': 'true',
                                'aria-label': 'Edit task name',
                            }}
                            sx={{
                                '& .MuiInputBase-root': { padding: 0 },
                                '& .MuiInputBase-input': {
                                    color: task.completed ? 'text.disabled' : 'text.primary',
                                    textDecoration: task.completed ? 'line-through' : 'none',
                                    fontSize: getTaskNameFontSize(localTaskName),
                                    lineHeight: 1.25,
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    padding: 0,
                                },
                            }}
                        />
                    ) : (
                        <Typography
                            variant="h5"
                            onClick={event => {
                                event.stopPropagation();
                                startTaskNameEditing();
                            }}
                            sx={{
                                maxWidth: '100%',
                                fontSize: getTaskNameFontSize(task.name ?? ''),
                                textAlign: 'left',
                                lineHeight: 1.25,
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                                whiteSpace: 'normal',
                                color: task.completed ? 'text.disabled' : 'text.primary',
                                textDecoration: task.completed ? 'line-through' : 'none',
                                cursor: 'text',
                            }}
                        >
                            {task.name}
                        </Typography>
                    )}
                </Box>
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

                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Project
                        </Typography>
                        <Chip
                            icon={<FolderOpenRoundedIcon />}
                            label={projectLabel}
                            size="small"
                            variant="outlined"
                            clickable
                            onClick={openProjectMenu}
                            aria-haspopup="menu"
                            aria-expanded={projectMenuAnchorEl !== null}
                            sx={{
                                maxWidth: '100%',
                                '& .MuiChip-icon': { color: 'text.secondary' },
                            }}
                        />
                        <Menu
                            open={projectMenuAnchorEl !== null}
                            anchorEl={projectMenuAnchorEl}
                            onClose={closeProjectMenu}
                            MenuListProps={{
                                dense: true,
                                onClick: event => event.stopPropagation(),
                            }}
                            slotProps={{
                                paper: { sx: { minWidth: 216, maxWidth: 300 } },
                            }}
                        >
                            <MenuItem
                                selected={effectiveProjectId === null}
                                onClick={() => selectProject(null)}
                            >
                                <ListItemIcon sx={{ minWidth: 30 }}>
                                    {effectiveProjectId === null && <CheckRoundedIcon fontSize="small" />}
                                </ListItemIcon>
                                <ListItemText>No project</ListItemText>
                            </MenuItem>
                            {projectsState.projects.map(project => (
                                <MenuItem
                                    key={project.projectId}
                                    selected={effectiveProjectId === project.projectId}
                                    onClick={() => selectProject(project.projectId)}
                                >
                                    <ListItemIcon sx={{ minWidth: 30 }}>
                                        {effectiveProjectId === project.projectId
                                            && <CheckRoundedIcon fontSize="small" />}
                                    </ListItemIcon>
                                    <ListItemText slotProps={{ primary: { noWrap: true } }}>
                                        {project.name}
                                    </ListItemText>
                                </MenuItem>
                            ))}
                            {projectsState.loading && projectsState.projects.length === 0 && (
                                <MenuItem disabled>
                                    <ListItemText>Loading projects…</ListItemText>
                                </MenuItem>
                            )}
                            {projectsState.error && (
                                <MenuItem onClick={refreshProjects}>
                                    <ListItemIcon sx={{ minWidth: 30 }}>
                                        <RefreshRoundedIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>Retry loading projects</ListItemText>
                                </MenuItem>
                            )}
                        </Menu>
                    </Box>

                    <Box sx={{ pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Subtasks {displayedSubtasks.length > 0 ? `· ${displayedSubtasks.filter(subtask => subtask.completed).length}/${displayedSubtasks.length}` : ''}
                        </Typography>
                        <Box
                            data-subtask-list="true"
                            sx={{
                                maxHeight: { xs: 240, sm: 280 },
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                overscrollBehaviorY: 'contain',
                                scrollbarGutter: 'stable',
                                pr: 0.5,
                            }}
                        >
                            <SubtaskList
                                items={displayedSubtasks}
                                onToggle={handleToggleSubtask}
                                onDelete={subtask => void handleDeleteSubtask(subtask)}
                                onUpdateName={handleUpdateSubtaskName}
                            />
                            {!visibleSubtaskState.loading && (
                                <SubtaskComposer
                                    taskId={task.taskId}
                                    onSubmit={handleCreateSubtask}
                                    composerRef={subtaskComposerRef}
                                />
                            )}
                        </Box>
                        {subtaskError && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
                                {subtaskError}
                            </Typography>
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
