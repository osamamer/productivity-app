import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    alpha,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    IconButton,
    LinearProgress,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import TuneIcon from '@mui/icons-material/Tune';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Client, StompSubscription } from '@stomp/stompjs';
import keycloak from '../services/keycloak';
import { taskService } from '../services/api';
import { Task } from '../types/Task';
import { PomodoroStatus } from '../types/PomodoroStatus';
import { requestSystemNotificationPermission } from '../services/systemNotifications';
import {
    createPomodoroFormDefaults,
    getPomodoroConfig,
    isPomodoroFormDefaults,
    NORMAL_POMODORO_CONFIG,
    PomodoroConfig,
    PomodoroFormValues,
} from '../services/api/pomodoroConfigService';

// ─── types ─────────────────────────────────────────────────────────────────

export type FlatTaskRowProps = {
    task: Task;
    onToggle: (taskId: string, anchorEl?: HTMLElement) => void;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
    expandedPanel: 'pomodoro' | 'details' | null;
    onTogglePanel: (taskId: string, panel: 'pomodoro' | 'details') => void;
    onAutoExpand: (taskId: string, panel: 'pomodoro') => void;
    onDelete?: (task: Task, anchorEl: HTMLElement) => void;
    showScheduledDate?: boolean;
    showPomodoroButton?: boolean;
    showDetailsButton?: boolean;
    onSelect?: (task: Task) => void;
    selected?: boolean;
    onSelectionClick?: (task: Task, event: React.MouseEvent<HTMLElement>) => void;
    reorderable?: boolean;
    draggable?: boolean;
    onDragStart?: (task: Task) => void;
    onDragOver?: (task: Task, event: React.DragEvent<HTMLElement>) => void;
    onDrop?: (task: Task, event: React.DragEvent<HTMLElement>) => void;
    onDragEnd?: () => void;
    isDragging?: boolean;
    isDragTarget?: boolean;
    dragTargetEdge?: 'before' | 'after';
    isGroupDropTarget?: boolean;
    onPomodoroActiveChange?: (taskId: string, active: boolean) => void;
    onPomodoroStatusChange?: (taskId: string, status: PomodoroStatus) => void;
    onPomodoroFocusStart?: (taskId: string) => void;
    deferPomodoroHydration?: boolean;
    initialPomodoroStatus?: PomodoroStatus | null;
    expectedPomodoroActive?: boolean;
};

// ─── helpers ───────────────────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

function checkboxColor(importance: number): string {
    if (importance > 7) return '#ef4444';
    if (importance > 4) return '#eab308';
    return '#1976d2';
}

function formatSeconds(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(safeSeconds / 60);
    const s = safeSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function isWaitingForPhase(status: PomodoroStatus | null): boolean {
    return status?.phase === 'WAITING_FOR_BREAK' || status?.phase === 'WAITING_FOR_FOCUS';
}

function isBreakPhase(status: PomodoroStatus): boolean {
    return status.phase
        ? status.phase === 'BREAK' || status.phase === 'WAITING_FOR_BREAK'
        : !status.sessionActive;
}

const PRIORITY_OPTIONS = [
    { label: 'Low',    value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High',   value: 9, color: '#ef4444' },
];

function currentPriorityLabel(importance: number): string {
    if (importance > 7) return 'High';
    if (importance > 4) return 'Medium';
    return 'Low';
}

function formatScheduledDate(dateTime: string): string {
    const date = new Date(dateTime);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (taskDate.getTime() === today.getTime()) return 'Today';
    if (taskDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
    if (taskDate.getTime() === yesterday.getTime()) return 'Yesterday';

    const daysDiff = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (Math.abs(daysDiff) < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    if (date.getFullYear() !== now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isEditableDragOrigin(target: EventTarget | null): boolean {
    return target instanceof Element
        && target.closest('input, textarea, select, [contenteditable="true"], [data-task-text-area="true"]') !== null;
}

// ─── component ─────────────────────────────────────────────────────────────

export const FlatTaskRow = React.memo(function FlatTaskRow({
    task,
    onToggle,
    onUpdate,
    expandedPanel,
    onTogglePanel,
    onAutoExpand,
    onDelete,
    showScheduledDate = false,
    showPomodoroButton = true,
    showDetailsButton = true,
    onSelect,
    selected = false,
    onSelectionClick,
    reorderable = false,
    draggable = reorderable,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragging = false,
    isDragTarget = false,
    dragTargetEdge = 'before',
    isGroupDropTarget = false,
    onPomodoroActiveChange,
    onPomodoroStatusChange,
    onPomodoroFocusStart,
    deferPomodoroHydration = false,
    initialPomodoroStatus = null,
    expectedPomodoroActive = false,
}: FlatTaskRowProps) {
    const theme = useTheme();
    const accent = theme.palette.primary.light;
    const activeAccent = theme.palette.primary.main;

    const [pomodoroStatus, setPomodoroStatus] = useState<PomodoroStatus | null>(initialPomodoroStatus);
    const [pomodoroConfig, setPomodoroConfig] = useState<PomodoroConfig>(NORMAL_POMODORO_CONFIG);
    const [wsConnected, setWsConnected] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [pomodoroHydrated, setPomodoroHydrated] = useState(!deferPomodoroHydration);

    // Local description state — committed on blur to avoid an API call per keystroke
    const [localName, setLocalName] = useState(task.name ?? '');
    const [isEditingName, setIsEditingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    useEffect(() => { setLocalName(task.name ?? ''); }, [task.name]);
    const [localDesc, setLocalDesc] = useState(task.description ?? '');
    useEffect(() => { setLocalDesc(task.description ?? ''); }, [task.description]);

    const [form, setForm] = useState<PomodoroFormValues>(() =>
        createPomodoroFormDefaults(NORMAL_POMODORO_CONFIG)
    );

    useEffect(() => {
        if (!pomodoroHydrated) return;

        let cancelled = false;
        getPomodoroConfig()
            .then(config => {
                if (cancelled) return;
                setPomodoroConfig(config);
                setForm(previous =>
                    isPomodoroFormDefaults(previous, NORMAL_POMODORO_CONFIG)
                        ? createPomodoroFormDefaults(config)
                        : previous
                );
            })
            .catch(error => console.error('Failed to load Pomodoro configuration:', error));

        return () => {
            cancelled = true;
        };
    }, [pomodoroHydrated]);

    const stompRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<StompSubscription | null>(null);
    const previousSessionRunningRef = useRef<boolean | undefined>(initialPomodoroStatus?.sessionRunning);
    const activePomodoroIdRef = useRef<string | null>(initialPomodoroStatus?.pomodoroId ?? null);
    const endedPomodoroIdRef = useRef<string | null>(null);
    const onPomodoroActiveChangeRef = useRef(onPomodoroActiveChange);
    const onPomodoroStatusChangeRef = useRef(onPomodoroStatusChange);

    useEffect(() => {
        onPomodoroActiveChangeRef.current = onPomodoroActiveChange;
    }, [onPomodoroActiveChange]);

    useEffect(() => {
        onPomodoroStatusChangeRef.current = onPomodoroStatusChange;
    }, [onPomodoroStatusChange]);

    useEffect(() => {
        if (expandedPanel === 'pomodoro' || initialPomodoroStatus?.active) {
            setPomodoroHydrated(true);
        }
        if (initialPomodoroStatus?.active) {
            activePomodoroIdRef.current = initialPomodoroStatus.pomodoroId;
            setPomodoroStatus(initialPomodoroStatus);
        }
    }, [expandedPanel, initialPomodoroStatus]);

    // Subscribe only once this row's pomodoro is relevant.
    useEffect(() => {
        if (!pomodoroHydrated) {
            return;
        }

        const client = new Client({
            brokerURL: WS_URL,
            connectHeaders: { Authorization: `Bearer ${keycloak.token ?? ''}` },
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = () => {
            setWsConnected(true);
            subscriptionRef.current = client.subscribe(
                `/topic/pomodoro/${task.taskId}`,
                (msg) => {
                    try {
                        const nextStatus: PomodoroStatus = JSON.parse(msg.body);
                        if (!nextStatus.active) {
                            if (activePomodoroIdRef.current !== null
                                && activePomodoroIdRef.current !== nextStatus.pomodoroId) {
                                return;
                            }
                            activePomodoroIdRef.current = null;
                            endedPomodoroIdRef.current = nextStatus.pomodoroId;
                            setPomodoroStatus(null);
                            onPomodoroActiveChangeRef.current?.(task.taskId, false);
                        } else if (endedPomodoroIdRef.current !== nextStatus.pomodoroId) {
                            activePomodoroIdRef.current = nextStatus.pomodoroId;
                            setPomodoroStatus(nextStatus);
                            onPomodoroStatusChangeRef.current?.(task.taskId, nextStatus);
                        }
                    }
                    catch (e) { console.error('Error parsing pomodoro message:', e); }
                }
            );
        };

        client.onDisconnect = () => { setWsConnected(false); };
        client.onWebSocketError = () => { setWsConnected(false); };

        stompRef.current = client;
        client.activate();

        return () => {
            subscriptionRef.current?.unsubscribe();
            client.deactivate();
            setWsConnected(false);
        };
    }, [pomodoroHydrated, task.taskId]);

    // Auto-open an active timer after hydration.
    useEffect(() => {
        if (!pomodoroHydrated) {
            return;
        }

        if (initialPomodoroStatus?.active) {
            onAutoExpand(task.taskId, 'pomodoro');
            return;
        }

        taskService.getActivePomodoro()
            .then(status => {
                if (status?.active && status.associatedTaskId === task.taskId) {
                    activePomodoroIdRef.current = status.pomodoroId;
                    setPomodoroStatus(status);
                    onPomodoroStatusChangeRef.current?.(task.taskId, status);
                    onAutoExpand(task.taskId, 'pomodoro');
                } else if (expectedPomodoroActive) {
                    activePomodoroIdRef.current = null;
                    setPomodoroStatus(null);
                    onPomodoroActiveChangeRef.current?.(task.taskId, false);
                }
            })
            .catch(e => console.error('Error checking pomodoro status:', e));
    }, [expectedPomodoroActive, initialPomodoroStatus, onAutoExpand, pomodoroHydrated, task.taskId]);

    const togglePanel = useCallback((panel: 'pomodoro' | 'details') => {
        if (panel === 'pomodoro') {
            setPomodoroHydrated(true);
        }
        onTogglePanel(task.taskId, panel);
    }, [onTogglePanel, task.taskId]);

    const handleStart = async () => {
        setActionLoading(true);
        endedPomodoroIdRef.current = null;
        try {
            void requestSystemNotificationPermission()
                .catch(error => console.error('Failed to request Pomodoro notification permission:', error));
            await taskService.startPomodoro(
                task.taskId, form.focusDuration, form.shortBreakDuration,
                form.longBreakDuration, form.numFocuses, form.longBreakCooldown,
                pomodoroConfig.secondsMode,
            );
            onPomodoroActiveChange?.(task.taskId, true);
        } catch (e) {
            console.error('Error starting pomodoro:', e);
        }
        finally { setActionLoading(false); }
    };

    const handlePlayPause = async () => {
        setActionLoading(true);
        try {
            if (isWaitingForPhase(pomodoroStatus)) {
                await taskService.startNextPomodoroPhase(task.taskId);
            } else if (pomodoroStatus?.sessionRunning) {
                await taskService.pauseSession(task.taskId);
            } else {
                await taskService.unpauseSession(task.taskId);
            }
        } catch (e) { console.error('Error toggling pomodoro:', e); }
        finally { setActionLoading(false); }
    };

    const handleStop = async () => {
        setActionLoading(true);
        const stoppedPomodoroId = activePomodoroIdRef.current;
        if (stoppedPomodoroId) endedPomodoroIdRef.current = stoppedPomodoroId;
        try {
            await taskService.endPomodoro(task.taskId);
            activePomodoroIdRef.current = null;
            setPomodoroStatus(null);
            onPomodoroActiveChange?.(task.taskId, false);
        } catch (e) {
            endedPomodoroIdRef.current = null;
            console.error('Error stopping pomodoro:', e);
        }
        finally { setActionLoading(false); }
    };

    const handleFinishBreak = async () => {
        setActionLoading(true);
        try {
            await taskService.finishPomodoroBreak(task.taskId);
        } catch (e) {
            console.error('Error ending Pomodoro break:', e);
        }
        finally { setActionLoading(false); }
    };

    const handleDateChange = (newDate: Date | null) => {
        if (!newDate) return;
        const pad = (n: number) => String(n).padStart(2, '0');
        const iso = `${newDate.getFullYear()}-${pad(newDate.getMonth() + 1)}-${pad(newDate.getDate())}T${pad(newDate.getHours())}:${pad(newDate.getMinutes())}:00`;
        onUpdate(task.taskId, { scheduledPerformDateTime: iso });
    };

    const handleDescBlur = () => {
        if (localDesc !== (task.description ?? '')) {
            onUpdate(task.taskId, { description: localDesc });
        }
    };

    const handleNameCommit = () => {
        const trimmed = localName.trim();
        const fallbackName = task.name ?? '';

        setIsEditingName(false);
        setLocalName(trimmed || fallbackName);

        if (trimmed && trimmed !== fallbackName) {
            onUpdate(task.taskId, { name: trimmed });
        }
    };

    const handleNameCancel = () => {
        setLocalName(task.name ?? '');
        setIsEditingName(false);
    };

    const isActive  = Boolean(pomodoroStatus?.active);
    const activePomodoro = pomodoroStatus?.active;
    const sessionRunning = pomodoroStatus?.sessionRunning;

    useEffect(() => {
        if (activePomodoro !== undefined) {
            onPomodoroActiveChange?.(task.taskId, activePomodoro);
        }
    }, [activePomodoro, onPomodoroActiveChange, task.taskId]);

    useEffect(() => {
        const wasRunning = previousSessionRunningRef.current;
        previousSessionRunningRef.current = sessionRunning;
        if (wasRunning === false && sessionRunning === true) {
            onPomodoroFocusStart?.(task.taskId);
        }
    }, [onPomodoroFocusStart, sessionRunning, task.taskId]);

    // Break: pomodoro started but not in a focus session
    const waitingForPhase = isWaitingForPhase(pomodoroStatus);
    const isBreak   = isActive && isBreakPhase(pomodoroStatus!);
    // Paused: in a focus session but timer is not ticking
    const isPaused  = isActive && pomodoroStatus!.sessionActive && !pomodoroStatus!.sessionRunning;
    // Both states share the green "at rest" colour on the progress bar
    const useGreenBar = isBreak || isPaused;
    const progressPct = pomodoroStatus
        ? (() => {
            const passed = Math.max(0, pomodoroStatus.secondsPassedInSession);
            const remaining = Math.max(0, pomodoroStatus.secondsUntilNextTransition);
            const total = passed + remaining;
            return total > 0 ? Math.min(100, (passed / total) * 100) : 0;
        })()
        : 0;

    const cbColor = checkboxColor(task.importance);
    const schedDate = task.scheduledPerformDateTime ? new Date(task.scheduledPerformDateTime) : null;
    const scheduledLabel = task.scheduledPerformDateTime ? formatScheduledDate(task.scheduledPerformDateTime) : '';

    const handleRowSelection = (event: React.MouseEvent<HTMLElement>) => {
        onSelectionClick?.(task, event);
        onSelect?.(task);
    };

    return (
        <Box
            data-task-id={task.taskId}
            data-pomodoro-focus-task={expectedPomodoroActive ? 'true' : undefined}
            draggable={draggable}
            sx={{
                position: 'relative',
                borderRadius: 1.5,
                border: '1.5px solid transparent',
                borderColor:
                    isActive
                        ? (useGreenBar ? theme.palette.success.main : alpha(activeAccent, 0.7))
                        : selected
                            ? alpha(activeAccent, 0.38)
                            : 'transparent',
                borderBottom: isActive ? 'none' : undefined,
                backgroundColor: isActive
                    ? alpha(activeAccent, 0.05)
                    : selected
                        ? alpha(activeAccent, 0.09)
                        : isDragTarget || isGroupDropTarget
                            ? alpha(activeAccent, 0.045)
                            : 'transparent',
                overflow: 'hidden',
                mb: 0.25,
                opacity: isDragging ? 0.42 : 1,
                transform: isDragging ? 'scale(0.985)' : 'scale(1)',
                boxShadow: isDragging ? `0 10px 24px ${alpha(activeAccent, 0.18)}` : 'none',
                transition: 'opacity 0.16s, transform 0.16s, box-shadow 0.16s, border-color 0.2s, background-color 0.2s',
                '&::before': isDragTarget && !isGroupDropTarget ? {
                    content: '""',
                    position: 'absolute',
                    top: dragTargetEdge === 'before' ? 0 : 'auto',
                    bottom: dragTargetEdge === 'after' ? 0 : 'auto',
                    left: 10,
                    right: 10,
                    height: 2,
                    borderRadius: 2,
                    backgroundColor: 'primary.main',
                    zIndex: 2,
                } : undefined,
            }}
            onClick={handleRowSelection}
            onMouseDownCapture={(event) => {
                event.currentTarget.draggable = Boolean(draggable && !isEditableDragOrigin(event.target));
            }}
            onMouseUpCapture={(event) => {
                event.currentTarget.draggable = Boolean(draggable);
            }}
            onDragStart={(event) => {
                if (!draggable) return;
                if (isEditableDragOrigin(event.target)) {
                    event.preventDefault();
                    return;
                }
                event.stopPropagation();
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', task.taskId);
                onDragStart?.(task);
            }}
            onDragOver={(event) => {
                if (!reorderable) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                onDragOver?.(task, event);
            }}
            onDrop={(event) => {
                if (!reorderable) return;
                event.preventDefault();
                event.stopPropagation();
                onDrop?.(task, event);
            }}
            onDragEnd={onDragEnd}
        >
            {/* ── Main row ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, px: 0.5 }}>
                <Checkbox
                    size="small"
                    checked={task.completed}
                    onChange={event => onToggle(task.taskId, event.currentTarget.parentElement ?? event.currentTarget)}
                    sx={{ color: cbColor, '&.Mui-checked': { color: cbColor }, mr: 0.5 }}
                />
                <Box
                    data-task-text-area="true"
                    sx={{ flex: 1, minWidth: 0, position: 'relative' }}
                >
                    <Typography
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRowSelection(e);
                            setIsEditingName(true);
                        }}
                        sx={{
                            width: '100%',
                            fontSize: '1.05rem',
                            lineHeight: 1.6,
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            hyphens: 'auto',
                            textAlign: 'left',
                            color: task.completed ? 'text.disabled' : 'text.primary',
                            textDecoration: task.completed ? 'line-through' : 'none',
                            visibility: isEditingName ? 'hidden' : 'visible',
                        }}
                    >
                        {task.name}
                    </Typography>
                    {isEditingName && (
                        <TextField
                            value={localName}
                            inputRef={nameInputRef}
                            onClick={event => event.stopPropagation()}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameCommit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleNameCommit();
                                }
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleNameCancel();
                                }
                            }}
                            variant="standard"
                            autoFocus
                            fullWidth
                            multiline
                            inputProps={{ draggable: false }}
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                '& .MuiInputBase-root': {
                                    height: '100%',
                                    padding: 0,
                                },
                                '& .MuiInputBase-input': {
                                    color: task.completed ? 'text.disabled' : 'text.primary',
                                    textDecoration: task.completed ? 'line-through' : 'none',
                                    fontSize: '1.05rem',
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    hyphens: 'auto',
                                    textAlign: 'left',
                                    padding: 0,
                                },
                            }}
                        />
                    )}
                </Box>

                {showScheduledDate && scheduledLabel && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mx: 1.5, minWidth: 84, textAlign: 'right', flexShrink: 0 }}
                    >
                        {scheduledLabel}
                    </Typography>
                )}

                {(showPomodoroButton || showDetailsButton || onDelete) && (
                    <Box sx={{ display: 'flex', gap: 0.25, ml: 0.5 }}>
                        {showPomodoroButton && (
                            <Tooltip title="Pomodoro">
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRowSelection(e);
                                        togglePanel('pomodoro');
                                    }}
                                    color={expandedPanel === 'pomodoro' || isActive ? 'primary' : 'default'}
                                >
                                    <TimerIcon sx={{ fontSize: '1.1rem' }} />
                                </IconButton>
                            </Tooltip>
                        )}
                        {showDetailsButton && (
                            <Tooltip title="Details">
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRowSelection(e);
                                        togglePanel('details');
                                    }}
                                    color={expandedPanel === 'details' ? 'primary' : 'default'}
                                >
                                    <TuneIcon sx={{ fontSize: '1.1rem' }} />
                                </IconButton>
                            </Tooltip>
                        )}
                        {onDelete && (
                            <Tooltip title="Delete task">
                                <IconButton
                                    size="small"
                                    aria-label={`Delete ${task.name}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(task, e.currentTarget);
                                    }}
                                    color="error"
                                >
                                    <DeleteOutlineIcon sx={{ fontSize: '1.1rem' }} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                )}
            </Box>

            {/* ── Pomodoro panel ── */}
            {expandedPanel === 'pomodoro' && (
                <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                    {!isActive ? (
                        <Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
                                {(
                                    [
                                        { key: 'focusDuration',      label: `Focus (${pomodoroConfig.durationUnit})`       },
                                        { key: 'shortBreakDuration', label: `Short break (${pomodoroConfig.durationUnit})` },
                                        { key: 'longBreakDuration',  label: `Long break (${pomodoroConfig.durationUnit})`  },
                                        { key: 'numFocuses',         label: 'Sessions'          },
                                    ] as const
                                ).map(({ key, label }) => (
                                    <TextField
                                        key={key}
                                        label={label}
                                        type="number"
                                        size="small"
                                        value={form[key]}
                                        onChange={(e) => setForm(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                        disabled={actionLoading}
                            inputProps={{ style: { textAlign: 'left' }, draggable: false }}
                                    />
                                ))}
                            </Box>
                            <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                disabled={!wsConnected || actionLoading}
                                onClick={handleStart}
                                startIcon={actionLoading ? <CircularProgress size={14} /> : <PlayArrowIcon />}
                                sx={{
                                    borderColor: 'primary',
                                    color: 'primary',
                                    '&:hover': {
                                        borderColor: 'primary',
                                        backgroundColor: alpha(activeAccent, 0.08),
                                    },
                                }}
                            >
                                {actionLoading ? 'Starting…' : !wsConnected ? 'Connecting…' : 'Start'}
                            </Button>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ textAlign: 'left' }}>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        display: 'block',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                        color: isBreak ? 'success.main' : accent,
                                    }}
                                >
                                    {waitingForPhase
                                        ? (pomodoroStatus!.phase === 'WAITING_FOR_BREAK' ? 'Break ready' : 'Focus ready')
                                        : isBreak ? 'Break' : 'Focus'}
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>
                                    {waitingForPhase ? 'Ready' : formatSeconds(pomodoroStatus!.secondsUntilNextTransition)}
                                </Typography>
                            </Box>

                            {/* Focus dots — lighter inactive shade */}
                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                {Array.from({ length: pomodoroStatus!.numFocuses }).map((_, i) => (
                                    <Box
                                        key={i}
                                        sx={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            backgroundColor: i < pomodoroStatus!.currentFocusNumber
                                                ? accent
                                                : alpha(accent, 0.12),
                                            transition: 'background-color 0.3s',
                                        }}
                                    />
                                ))}
                            </Box>

                            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                                {(waitingForPhase || !isBreak) && (
                                    <IconButton size="small" onClick={handlePlayPause} disabled={actionLoading} color="primary">
                                        {!waitingForPhase && pomodoroStatus!.sessionRunning ? <PauseIcon /> : <PlayArrowIcon />}
                                    </IconButton>
                                )}
                                {pomodoroStatus!.phase === 'BREAK' && (
                                    <Tooltip title="End break and start the next focus session">
                                        <span>
                                            <IconButton
                                                size="small"
                                                onClick={handleFinishBreak}
                                                disabled={actionLoading}
                                                color="success"
                                            >
                                                <SkipNextIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                )}
                                <IconButton size="small" onClick={handleStop} disabled={actionLoading} color="error">
                                    <StopIcon color="primary" />
                                </IconButton>
                            </Box>
                        </Box>
                    )}
                </Box>
            )}

            {/* ── Details panel ── */}
            {expandedPanel === 'details' && (
                <Box sx={{ px: 2, pb: 2, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

                    {/* Priority chips */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, textAlign: 'left' }}>
                            Priority
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {PRIORITY_OPTIONS.map(opt => {
                                const selected = currentPriorityLabel(task.importance) === opt.label;
                                return (
                                    <Chip
                                        key={opt.label}
                                        label={opt.label}
                                        size="small"
                                        onClick={() => onUpdate(task.taskId, { importance: opt.value })}
                                        sx={{
                                            borderColor: opt.color,
                                            color: selected ? '#fff' : opt.color,
                                            backgroundColor: selected ? opt.color : 'transparent',
                                            border: `1px solid ${opt.color}`,
                                            cursor: 'pointer',
                                            fontWeight: selected ? 600 : 400,
                                            transition: 'all 0.15s',
                                        }}
                                    />
                                );
                            })}
                        </Box>
                    </Box>

                    {/* Scheduled date/time */}
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateTimePicker
                            label="Scheduled"
                            value={schedDate}
                            onChange={handleDateChange}
                            ampm={false}
                            slotProps={{
                                textField: { size: 'small', fullWidth: true },
                            }}
                        />
                    </LocalizationProvider>

                    {/* Description */}
                    <TextField
                        label="Description"
                        value={localDesc}
                        onChange={(e) => setLocalDesc(e.target.value)}
                        onBlur={handleDescBlur}
                        multiline
                        minRows={2}
                        maxRows={5}
                        size="small"
                        fullWidth
                        placeholder="Add a note…"
                        inputProps={{ style: { textAlign: 'left' } }}
                    />

                    {/* Tag (read-only) */}
                    {task.tag && (
                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
                            Tag: <strong>{task.tag}</strong>
                        </Typography>
                    )}
                </Box>
            )}

            {/* ── Progress bar as bottom border when pomodoro is running ── */}
            {isActive && (
                <LinearProgress
                    variant="determinate"
                    value={progressPct}
                    sx={{
                        position: 'absolute',
                        bottom: 0, left: 0, right: 0,
                        height: 2,
                        borderRadius: 0,
                        backgroundColor: alpha(useGreenBar ? theme.palette.success.main : activeAccent, 0.15),
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: useGreenBar ? theme.palette.success.main : activeAccent,
                            borderRadius: 0,
                        },
                    }}
                />
            )}
        </Box>
    );
});
