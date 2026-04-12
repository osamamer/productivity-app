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
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Client, StompSubscription } from '@stomp/stompjs';
import keycloak from '../services/keycloak';
import { taskService } from '../services/api';
import { Task } from '../types/Task';

// ─── types ─────────────────────────────────────────────────────────────────

interface PomodoroStatus {
    taskId: string;
    active: boolean;
    sessionActive: boolean;
    sessionRunning: boolean;
    secondsPassedInSession: number;
    secondsUntilNextTransition: number;
    currentFocusNumber: number;
    numFocuses: number;
}

interface PomodoroForm {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    numFocuses: number;
    longBreakCooldown: number;
}

export type FlatTaskRowProps = {
    task: Task;
    onToggle: (taskId: string) => void;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
    expandedPanel: 'pomodoro' | 'details' | null;
    onTogglePanel: (panel: 'pomodoro' | 'details') => void;
    onAutoExpand: (panel: 'pomodoro') => void;
    showScheduledDate?: boolean;
    onSelect?: (task: Task) => void;
    deferPomodoroHydration?: boolean;
};

// ─── helpers ───────────────────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

function checkboxColor(importance: number): string {
    if (importance > 7) return '#ef4444';
    if (importance > 4) return '#eab308';
    return '#1976d2';
}

function formatSeconds(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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

// ─── component ─────────────────────────────────────────────────────────────

export function FlatTaskRow({
    task,
    onToggle,
    onUpdate,
    expandedPanel,
    onTogglePanel,
    onAutoExpand,
    showScheduledDate = false,
    onSelect,
    deferPomodoroHydration = false,
}: FlatTaskRowProps) {
    const theme = useTheme();
    // Use the lighter shade of primary throughout — softer on the eye
    const accent = theme.palette.primary.light;
    const lightBlue   = '#90caf9';
    const lightPurple = '#ce93d8';

    const [pomodoroStatus, setPomodoroStatus] = useState<PomodoroStatus | null>(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [pomodoroHydrated, setPomodoroHydrated] = useState(!deferPomodoroHydration);

    // Local description state — committed on blur to avoid an API call per keystroke
    const [localName, setLocalName] = useState(task.name ?? '');
    const [isEditingName, setIsEditingName] = useState(false);
    useEffect(() => { setLocalName(task.name ?? ''); }, [task.name]);
    const [localDesc, setLocalDesc] = useState(task.description ?? '');
    useEffect(() => { setLocalDesc(task.description ?? ''); }, [task.description]);

    const [form, setForm] = useState<PomodoroForm>({
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        numFocuses: 4,
        longBreakCooldown: 4,
    });

    const stompRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<StompSubscription | null>(null);

    useEffect(() => {
        if (expandedPanel === 'pomodoro') {
            setPomodoroHydrated(true);
        }
    }, [expandedPanel]);

    // On mount: connect WebSocket and subscribe to pomodoro updates for this task.
    // Connecting on mount (not on panel open) means the panel opens into an already-live
    // connection — no handshake delay, no "Connecting…" flicker.
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
                    try { setPomodoroStatus(JSON.parse(msg.body)); }
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

    // On mount: check if this task already has an active pomodoro running and
    // auto-open the panel so the user doesn't lose their session after a page remount.
    useEffect(() => {
        if (!pomodoroHydrated) {
            return;
        }

        taskService.getActivePomodoro(task.taskId)
            .then(status => {
                if (status?.active) {
                    setPomodoroStatus(status as unknown as PomodoroStatus);
                    onAutoExpand('pomodoro');
                }
            })
            .catch(e => console.error('Error checking pomodoro status:', e));
    // onAutoExpand is a stable arrow function defined inline in the parent — intentionally
    // omitted from deps to avoid re-running when the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pomodoroHydrated, task.taskId]);

    const togglePanel = useCallback((panel: 'pomodoro' | 'details') => {
        if (panel === 'pomodoro') {
            setPomodoroHydrated(true);
        }
        onTogglePanel(panel);
    }, [onTogglePanel]);

    const handleStart = async () => {
        setActionLoading(true);
        try {
            await taskService.startPomodoro(
                task.taskId, form.focusDuration, form.shortBreakDuration,
                form.longBreakDuration, form.numFocuses, form.longBreakCooldown,
            );
        } catch (e) { console.error('Error starting pomodoro:', e); }
        finally { setActionLoading(false); }
    };

    const handlePlayPause = async () => {
        setActionLoading(true);
        try {
            if (pomodoroStatus?.sessionRunning) {
                await taskService.pauseSession(task.taskId);
            } else {
                await taskService.unpauseSession(task.taskId);
            }
        } catch (e) { console.error('Error toggling pomodoro:', e); }
        finally { setActionLoading(false); }
    };

    const handleStop = async () => {
        setActionLoading(true);
        try {
            await taskService.endPomodoro(task.taskId);
            setPomodoroStatus(null);
        } catch (e) { console.error('Error stopping pomodoro:', e); }
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
    // Break: pomodoro started but not in a focus session
    const isBreak   = isActive && !pomodoroStatus!.sessionActive;
    // Paused: in a focus session but timer is not ticking
    const isPaused  = isActive && pomodoroStatus!.sessionActive && !pomodoroStatus!.sessionRunning;
    // Both states share the green "at rest" colour on the progress bar
    const useGreenBar = isBreak || isPaused;
    const progressPct = pomodoroStatus
        ? (() => {
            const total = pomodoroStatus.secondsPassedInSession + pomodoroStatus.secondsUntilNextTransition;
            return total > 0 ? (pomodoroStatus.secondsPassedInSession / total) * 100 : 0;
        })()
        : 0;

    const cbColor = checkboxColor(task.importance);
    const schedDate = task.scheduledPerformDateTime ? new Date(task.scheduledPerformDateTime) : null;
    const scheduledLabel = task.scheduledPerformDateTime ? formatScheduledDate(task.scheduledPerformDateTime) : '';

    return (
        <Box
            sx={{
                position: 'relative',
                borderRadius: 1.5,
                // Transparent border when idle keeps layout stable — no shift on activation
                border: `1.5px solid ${isActive ? (useGreenBar ? theme.palette.success.main : alpha(lightPurple, 0.7)) : 'transparent'}`,
                borderBottom: isActive ? 'none' : '1.5px solid transparent',
                backgroundColor: isActive ? alpha(lightPurple, 0.04) : 'transparent',
                transition: 'border-color 0.3s, background-color 0.3s',
                overflow: 'hidden',
                mb: 0.25,
            }}
            onClick={() => onSelect?.(task)}
        >
            {/* ── Main row ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, px: 0.5 }}>
                <Checkbox
                    size="small"
                    checked={task.completed}
                    onChange={(e) => { e.stopPropagation(); onToggle(task.taskId); }}
                    sx={{ color: cbColor, '&.Mui-checked': { color: cbColor }, mr: 0.5 }}
                />
                {isEditingName ? (
                    <TextField
                        value={localName}
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
                        inputProps={{
                            style: {
                                fontSize: '1.05rem',
                                lineHeight: 1.6,
                                textAlign: 'left',
                            },
                        }}
                        sx={{
                            flex: 1,
                            '& .MuiInputBase-input': {
                                color: task.completed ? 'text.disabled' : 'text.primary',
                                textDecoration: task.completed ? 'line-through' : 'none',
                            },
                        }}
                    />
                ) : (
                    <Typography
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect?.(task);
                            setIsEditingName(true);
                        }}
                        sx={{
                            flex: 1,
                            fontSize: '1.05rem',
                            lineHeight: 1.6,
                            textAlign: 'left',
                            color: task.completed ? 'text.disabled' : 'text.primary',
                            textDecoration: task.completed ? 'line-through' : 'none',
                            cursor: 'text',
                        }}
                    >
                        {task.name}
                    </Typography>
                )}

                {showScheduledDate && scheduledLabel && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mx: 1.5, minWidth: 84, textAlign: 'right', flexShrink: 0 }}
                    >
                        {scheduledLabel}
                    </Typography>
                )}

                {task.importance > 7 && !task.completed && (
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#ef4444', mx: 1.5, flexShrink: 0 }} />
                )}

                <Box sx={{ display: 'flex', gap: 0.25, ml: 0.5 }}>
                    <Tooltip title="Pomodoro">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect?.(task);
                                togglePanel('pomodoro');
                            }}
                            color={expandedPanel === 'pomodoro' || isActive ? 'primary' : 'default'}
                        >
                            <TimerIcon sx={{ fontSize: '1.1rem' }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Details">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect?.(task);
                                togglePanel('details');
                            }}
                            color={expandedPanel === 'details' ? 'primary' : 'default'}
                        >
                            <TuneIcon sx={{ fontSize: '1.1rem' }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* ── Pomodoro panel ── */}
            {expandedPanel === 'pomodoro' && (
                <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                    {!isActive ? (
                        <Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
                                {(
                                    [
                                        { key: 'focusDuration',      label: 'Focus (min)'       },
                                        { key: 'shortBreakDuration', label: 'Short break (min)' },
                                        { key: 'longBreakDuration',  label: 'Long break (min)'  },
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
                                        inputProps={{ style: { textAlign: 'left' } }}
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
                                        backgroundColor: alpha(lightPurple, 0.08),
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
                                    {isBreak ? 'Break' : 'Focus'}
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>
                                    {formatSeconds(pomodoroStatus!.secondsUntilNextTransition)}
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
                                {/* Play/pause only shown during focus — not during break */}
                                {!isBreak && (
                                    <IconButton size="small" onClick={handlePlayPause} disabled={actionLoading} color="primary">
                                        {pomodoroStatus!.sessionRunning ? <PauseIcon /> : <PlayArrowIcon />}
                                    </IconButton>
                                )}
                                <IconButton size="small" onClick={handleStop} disabled={actionLoading} color="error">
                                    <StopIcon />
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
                        backgroundColor: alpha(useGreenBar ? theme.palette.success.main : lightPurple, 0.15),
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: useGreenBar ? theme.palette.success.main : lightPurple,
                            borderRadius: 0,
                        },
                    }}
                />
            )}
        </Box>
    );
}
