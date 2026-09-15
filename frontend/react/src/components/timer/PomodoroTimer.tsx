import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import {
    Box,
    Button,
    Typography,
    Stack,
    Alert,
    IconButton,
    CircularProgress,
    Chip,
    Slide,
    Snackbar,
    Tooltip,
    useTheme,
    alpha,
} from '@mui/material';
import { HoverCardBox } from '../box/HoverCardBox.tsx';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import TimerIcon from '@mui/icons-material/Timer';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { taskService } from '../../services/api/index.ts'; // Import the service
import { requestSystemNotificationPermission } from '../../services/systemNotifications';
import {
    createPomodoroFormDefaults,
    getPomodoroConfig,
    isPomodoroFormDefaults,
    NORMAL_POMODORO_CONFIG,
    PomodoroConfig,
    PomodoroFormValues,
    readPomodoroFormPreferences,
    savePomodoroFormPreferences,
    subscribeToPomodoroFormPreferences,
} from '../../services/api/pomodoroConfigService';
import { GENERIC_ERROR_MESSAGE } from '../../services/utils/userMessages';
import { PomodoroNumberField } from './PomodoroNumberField';
import { createAuthenticatedStompClient } from '../../services/authenticatedStompClient';
import { usePomodoro } from '../../hooks/usePomodoro';
import { PomodoroStatus } from '../../types/PomodoroStatus';
import { WhiteNoiseControl } from './WhiteNoiseControl';
import {
    createOptimisticCompletedPomodoroStatus,
    createOptimisticPomodoroStatus,
    getOptimisticPomodoroStatus,
} from '../../services/utils/optimisticPomodoro';

interface Task {
    taskId: string;
    name: string;
}

interface Props {
    task: Task | null;
    onActiveChange?: (active: boolean) => void;
}

const WS_URL = import.meta.env.VITE_WS_URL
    || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

const SlideFromRight = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof Slide>>(
    (props, ref) => <Slide {...props} ref={ref} direction="left" />,
);
SlideFromRight.displayName = 'SlideFromRight';

type PomodoroFeedback = { id: number; message: string };

function isWaitingForPhase(status: PomodoroStatus | null): boolean {
    return status?.phase === 'WAITING_FOR_BREAK' || status?.phase === 'WAITING_FOR_FOCUS';
}

export function PomodoroTimer({ task, onActiveChange }: Props) {
    const theme = useTheme();
    const pomodoroGreen = theme.palette.mode === 'dark' ? '#9BC5A3' : '#7EA88A';
    const pomodoroGreenForeground = theme.palette.mode === 'dark' ? '#111827' : '#1A1A2E';
    const {
        activePomodoro,
        refreshActivePomodoro,
        publishPomodoroStatus,
        clearPomodoroMutation,
    } = usePomodoro();
    const [status, setStatus] = useState<PomodoroStatus | null>(() => (
        activePomodoro?.associatedTaskId === task?.taskId ? activePomodoro : null
    ));
    const [pomodoroConfig, setPomodoroConfig] = useState<PomodoroConfig>(NORMAL_POMODORO_CONFIG);
    const lastPomodoroStatusRef = useRef<PomodoroStatus | null>(status);
    const pomodoroMutationRevisionRef = useRef(0);

    useEffect(() => {
        onActiveChange?.(Boolean(status?.active));
    }, [status?.active, onActiveChange]);
    useEffect(() => {
        if (activePomodoro?.active && activePomodoro.associatedTaskId === task?.taskId) {
            lastPomodoroStatusRef.current = activePomodoro;
            setStatus(activePomodoro);
        } else if (!activePomodoro) {
            setStatus(previous => {
                const next = previous?.active ? null : previous;
                lastPomodoroStatusRef.current = next;
                return next;
            });
        }
    }, [activePomodoro, task?.taskId]);
    const [isConnected, setIsConnected] = useState(false);
    const [pomodoroFeedback, setPomodoroFeedback] = useState<PomodoroFeedback | null>(null);
    const stompClientRef = useRef<Client | null>(null);
    const pomodoroFeedbackIdRef = useRef(0);

    const showPomodoroError = useCallback(() => {
        pomodoroFeedbackIdRef.current += 1;
        setPomodoroFeedback({
            id: pomodoroFeedbackIdRef.current,
            message: GENERIC_ERROR_MESSAGE,
        });
    }, []);

    const [formData, setFormData] = useState<PomodoroFormValues>(() =>
        readPomodoroFormPreferences() ?? createPomodoroFormDefaults(NORMAL_POMODORO_CONFIG)
    );

    const updatePomodoroForm = (updates: Partial<PomodoroFormValues>) => {
        const next = { ...formData, ...updates };
        setFormData(next);
        savePomodoroFormPreferences(next);
    };

    const waitingForPhase = status?.phase === 'WAITING_FOR_BREAK' || status?.phase === 'WAITING_FOR_FOCUS';
    const isBreakPhase = status?.phase
        ? status.phase === 'BREAK' || status.phase === 'WAITING_FOR_BREAK'
        : Boolean(status && !status.sessionActive);
    const playPauseLabel = waitingForPhase
        ? status?.phase === 'WAITING_FOR_BREAK' ? 'Start break' : 'Start focus session'
        : status?.sessionRunning ? 'Pause focus session' : 'Resume focus session';

    const applyLocalPomodoroStatus = useCallback((
        nextStatus: PomodoroStatus | null,
        authoritative = false,
        optimistic = false,
    ): boolean => {
        if (!publishPomodoroStatus(nextStatus, authoritative, optimistic)) return false;
        lastPomodoroStatusRef.current = nextStatus;
        setStatus(nextStatus);
        return true;
    }, [publishPomodoroStatus]);

    const rollbackPomodoroMutation = useCallback((
        mutationRevision: number,
        optimisticStatus: PomodoroStatus,
        previousStatus: PomodoroStatus | null,
    ) => {
        if (pomodoroMutationRevisionRef.current !== mutationRevision
            || lastPomodoroStatusRef.current !== optimisticStatus) return;
        clearPomodoroMutation();
        applyLocalPomodoroStatus(previousStatus, true);
    }, [applyLocalPomodoroStatus, clearPomodoroMutation]);

    useEffect(() => {
        let cancelled = false;
        getPomodoroConfig()
            .then(config => {
                if (cancelled) return;
                setPomodoroConfig(config);
                setFormData(previous => readPomodoroFormPreferences()
                    ?? (isPomodoroFormDefaults(previous, NORMAL_POMODORO_CONFIG)
                        ? createPomodoroFormDefaults(config)
                        : previous));
            })
            .catch(error => console.error('Failed to load Pomodoro configuration:', error));

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => subscribeToPomodoroFormPreferences(() => {
        const stored = readPomodoroFormPreferences();
        if (stored) setFormData(stored);
    }), []);

    const handleTogglePlayPause = () => {
        if (!task) return;

        const previousStatus = lastPomodoroStatusRef.current?.active
            ? lastPomodoroStatusRef.current
            : status?.active ? status : null;
        if (!previousStatus) return;

        const optimisticStatus = getOptimisticPomodoroStatus(
            previousStatus,
            'toggle',
            formData,
            pomodoroConfig.secondsMode,
        );
        if (!optimisticStatus || !applyLocalPomodoroStatus(optimisticStatus, false, true)) return;

        const mutationRevision = ++pomodoroMutationRevisionRef.current;
        const request = isWaitingForPhase(previousStatus)
            ? taskService.startNextPomodoroPhase(task.taskId)
            : previousStatus.sessionRunning
                ? taskService.pauseSession(task.taskId)
                : taskService.unpauseSession(task.taskId);
        void request.then(() => {
            if (pomodoroMutationRevisionRef.current !== mutationRevision) return;
            void refreshActivePomodoro(true).catch(error => {
                console.error('Could not refresh the Pomodoro after changing its phase:', error);
            });
        }).catch(error => {
            console.error('Error toggling play/pause:', error);
            rollbackPomodoroMutation(mutationRevision, optimisticStatus, previousStatus);
            if (pomodoroMutationRevisionRef.current === mutationRevision) showPomodoroError();
        });
    };

    const handleEndSession = () => {
        if (!task) return;

        const previousStatus = lastPomodoroStatusRef.current?.active
            ? lastPomodoroStatusRef.current
            : status?.active ? status : null;
        if (!previousStatus) return;

        const optimisticStatus = createOptimisticCompletedPomodoroStatus(previousStatus);
        if (!applyLocalPomodoroStatus(optimisticStatus, false, true)) return;

        const mutationRevision = ++pomodoroMutationRevisionRef.current;
        void taskService.endPomodoro(task.taskId).then(completedStatus => {
            if (pomodoroMutationRevisionRef.current === mutationRevision
                && lastPomodoroStatusRef.current === optimisticStatus) {
                applyLocalPomodoroStatus(completedStatus, true);
            }
        }).catch(error => {
            console.error('Error ending session:', error);
            rollbackPomodoroMutation(mutationRevision, optimisticStatus, previousStatus);
            if (pomodoroMutationRevisionRef.current === mutationRevision) showPomodoroError();
        });
    };

    const handleFinishBreak = () => {
        if (!task) return;

        const previousStatus = lastPomodoroStatusRef.current?.active
            ? lastPomodoroStatusRef.current
            : status?.active ? status : null;
        if (!previousStatus) return;

        const optimisticStatus = getOptimisticPomodoroStatus(
            previousStatus,
            'finish-break',
            formData,
            pomodoroConfig.secondsMode,
        );
        if (!optimisticStatus || !applyLocalPomodoroStatus(optimisticStatus, false, true)) return;

        const mutationRevision = ++pomodoroMutationRevisionRef.current;
        void taskService.finishPomodoroBreak(task.taskId).then(() => {
            if (pomodoroMutationRevisionRef.current !== mutationRevision) return;
            void refreshActivePomodoro(true).catch(error => {
                console.error('Could not refresh the Pomodoro after ending its break:', error);
            });
        }).catch(error => {
            console.error('Error ending Pomodoro break:', error);
            rollbackPomodoroMutation(mutationRevision, optimisticStatus, previousStatus);
            if (pomodoroMutationRevisionRef.current === mutationRevision) showPomodoroError();
        });
    };

    const connectWebSocket = useCallback(() => {
        if (stompClientRef.current?.active) {
            console.log('STOMP client already active');
            return;
        }

        console.log('Creating new STOMP client...');
        const client = createAuthenticatedStompClient(WS_URL);
        client.onStompError = frame => {
            console.error('STOMP protocol error:', frame);
            setIsConnected(false);
        };

        client.onConnect = (frame) => {
            console.log('STOMP Client Connected:', frame);
            setIsConnected(true);
        };

        client.onDisconnect = () => {
            console.log('STOMP Client Disconnected');
            setIsConnected(false);
        };

        client.onWebSocketError = (error) => {
            console.error('WebSocket Error:', error);
            setIsConnected(false);
        };

        stompClientRef.current = client;

        try {
            console.log('Activating STOMP client...');
            client.activate();
        } catch (error) {
            console.error('Error activating STOMP client:', error);
        }

        return () => {
            if (client.active) {
                console.log('Deactivating STOMP client...');
                void client.deactivate();
            }
        };
    }, []);

    useEffect(() => {
        const cleanup = connectWebSocket();
        return () => {
            cleanup?.();
        };
    }, [connectWebSocket]);

    const subscribeToTask = useCallback((taskId: string) => {
        const client = stompClientRef.current;
        if (!client?.active) {
            console.log('Cannot subscribe: STOMP client not active');
            return;
        }

        const destination = `/topic/pomodoro/${taskId}`;
        console.log(`Subscribing to ${destination}`);

        try {
            return client.subscribe(destination, (message) => {
                try {
                    const newStatus: PomodoroStatus = JSON.parse(message.body);
                    if (!publishPomodoroStatus(newStatus)) return;
                    lastPomodoroStatusRef.current = newStatus;
                    setStatus(newStatus);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });
        } catch (error) {
            console.error('Error subscribing to task:', error);
        }
    }, [publishPomodoroStatus]);

    useEffect(() => {
        if (task?.taskId && isConnected) {
            const subscription = subscribeToTask(task.taskId);
            return () => {
                subscription?.unsubscribe();
            };
        }
    }, [task?.taskId, isConnected, subscribeToTask]);

    const startPomodoro = () => {
        // Starting before the live timer channel is ready is harmless; the
        // optimistic state keeps the timer usable while the socket connects.
        if (!task) return;

        const optimisticStatus = createOptimisticPomodoroStatus(
            task.taskId,
            formData,
            pomodoroConfig.secondsMode,
        );
        if (!applyLocalPomodoroStatus(optimisticStatus, false, true)) return;

        const mutationRevision = ++pomodoroMutationRevisionRef.current;
        void requestSystemNotificationPermission()
            .catch(error => console.error('Failed to request Pomodoro notification permission:', error));
        console.log('Starting pomodoro with data:', formData);
        void taskService.startPomodoro(
            task.taskId,
            formData.focusDuration,
            formData.shortBreakDuration,
            formData.longBreakDuration,
            formData.numFocuses,
            formData.longBreakCooldown,
            pomodoroConfig.secondsMode
        ).then(() => {
            if (pomodoroMutationRevisionRef.current !== mutationRevision) return;
            void refreshActivePomodoro(true).catch(error => {
                console.error('Could not refresh the Pomodoro after starting it:', error);
            });
            console.log('Pomodoro started successfully');
        }).catch(error => {
            console.error('Error starting pomodoro:', error);
            rollbackPomodoroMutation(mutationRevision, optimisticStatus, null);
            if (pomodoroMutationRevisionRef.current === mutationRevision) showPomodoroError();
        });
    };

    const formatTime = (seconds: number): string => {
        const safeSeconds = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(safeSeconds / 60);
        const remainingSeconds = safeSeconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const isBreakTime = () => isBreakPhase;

    const getProgressPercentage = () => {
        if (!status) return 0;
        const passed = Math.max(0, status.secondsPassedInSession);
        const remaining = Math.max(0, status.secondsUntilNextTransition);
        const total = passed + remaining;
        return total > 0 ? Math.min(100, (passed / total) * 100) : 0;
    };

    const durationUnitLabel = pomodoroConfig.durationUnit;

    if (!task) {
        return (
            <HoverCardBox>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <TimerIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                        Select a task to start a Pomodoro session
                    </Typography>
                </Box>
            </HoverCardBox>
        );
    }

    return (
        <Box sx={{ pt: 5 }}>
            <Stack spacing={3} sx={{ width: '100%' }}>
                {!status?.active ? (
                    <>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ mb: 2 }} variant="h5" gutterBottom>
                                Pomodoro Timer
                            </Typography>
                            <TimerIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <PomodoroNumberField
                                name="focusDuration"
                                label={`Focus (${durationUnitLabel})`}
                                value={formData.focusDuration}
                                onChange={value => updatePomodoroForm({ focusDuration: value })}
                            />
                            <PomodoroNumberField
                                name="shortBreakDuration"
                                label={`Short Break (${durationUnitLabel})`}
                                value={formData.shortBreakDuration}
                                onChange={value => updatePomodoroForm({ shortBreakDuration: value })}
                            />
                            <PomodoroNumberField
                                name="longBreakDuration"
                                label={`Long Break (${durationUnitLabel})`}
                                value={formData.longBreakDuration}
                                onChange={value => updatePomodoroForm({ longBreakDuration: value })}
                            />
                            <PomodoroNumberField
                                name="numFocuses"
                                label="Focus Sessions"
                                value={formData.numFocuses}
                                onChange={value => updatePomodoroForm({ numFocuses: value })}
                                min={1}
                                max={10}
                            />
                        </Box>

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={startPomodoro}
                            fullWidth
                            startIcon={<PlayArrowIcon />}
                        >
                            Start Session
                        </Button>
                    </>
                ) : (
                    <>
                        <Box sx={{ textAlign: 'center', position: 'relative' }}>
                            {/* Circular Progress */}
                            <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                                <CircularProgress
                                    variant="determinate"
                                    value={100}
                                    size={200}
                                    thickness={2}
                                    sx={{
                                        color: 'action.disabled',
                                        position: 'absolute',
                                    }}
                                />
                                <CircularProgress
                                    variant="determinate"
                                    value={getProgressPercentage()}
                                    size={200}
                                    thickness={2}
                                    sx={{
                                        color: isBreakTime() ? pomodoroGreen : 'primary.main',
                                        '& .MuiCircularProgress-circle': {
                                            strokeLinecap: 'round',
                                        },
                                    }}
                                />
                                <Box
                                    sx={{
                                        top: 0,
                                        left: 0,
                                        bottom: 0,
                                        right: 0,
                                        position: 'absolute',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                    }}
                                >
                                    {isBreakTime() ? (
                                        <FreeBreakfastIcon sx={{ fontSize: 32, color: pomodoroGreen, mb: 1 }} />
                                    ) : (
                                        <TimerIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                                    )}
                                    <Typography
                                        variant={waitingForPhase ? 'h5' : 'h3'}
                                        component="div"
                                        fontWeight="bold"
                                        sx={waitingForPhase ? {
                                            letterSpacing: 1.1,
                                            lineHeight: 0.95,
                                            textAlign: 'center',
                                            whiteSpace: 'normal',
                                            color: status.phase === 'WAITING_FOR_BREAK' ? pomodoroGreen : undefined,
                                        } : undefined}
                                    >
                                        {waitingForPhase
                                            ? (status.phase === 'WAITING_FOR_BREAK' ? ['BREAK', 'TIME'] : ['WORK', 'TIME']).map(word => (
                                                <Box component="span" key={word} sx={{ display: 'block' }}>
                                                    {word}
                                                </Box>
                                            ))
                                            : formatTime(status.secondsUntilNextTransition)}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Task Name */}
                            <Typography
                                variant="h6"
                                gutterBottom
                                sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {task.name}
                            </Typography>

                            {/* Status Chip */}
                            {!waitingForPhase && (
                                <Chip
                                    label={isBreakTime() ? 'BREAK TIME' : 'WORK TIME'}
                                    color={isBreakTime() ? 'default' : 'primary'}
                                    icon={isBreakTime() ? <FreeBreakfastIcon /> : <TimerIcon />}
                                    sx={isBreakTime() ? {
                                        mb: 2,
                                        backgroundColor: pomodoroGreen,
                                        color: pomodoroGreenForeground,
                                        '& .MuiChip-icon': { color: pomodoroGreenForeground },
                                    } : { mb: 2 }}
                                />
                            )}

                            {/* Session Progress */}
                            <Box sx={{
                                display: 'flex',
                                gap: 0.5,
                                justifyContent: 'center',
                                mb: 2
                            }}>
                                {Array.from({ length: status.numFocuses }).map((_, index) => (
                                    <Box
                                        key={index}
                                        sx={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            backgroundColor: index < status.currentFocusNumber
                                                ? 'primary.main'
                                                : 'action.disabled',
                                            transition: 'all 0.3s',
                                        }}
                                    />
                                ))}
                            </Box>

                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                                Session {status.currentFocusNumber} of {status.numFocuses}
                            </Typography>

                            {/* Timer controls */}
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                    <WhiteNoiseControl size="large" />
                                {(status.sessionActive || waitingForPhase) && (
                                    <Tooltip title={playPauseLabel}>
                                        <span>
                                            <IconButton
                                                onClick={handleTogglePlayPause}
                                                aria-label={playPauseLabel}
                                                color={waitingForPhase && status.phase === 'WAITING_FOR_BREAK' ? 'inherit' : 'primary'}
                                                size="large"
                                                sx={{
                                                    color: waitingForPhase && status.phase === 'WAITING_FOR_BREAK' ? pomodoroGreen : undefined,
                                                    backgroundColor: 'action.hover',
                                                    '&:hover': { backgroundColor: 'action.selected' },
                                                }}
                                            >
                                                {!waitingForPhase && status.sessionRunning ? <PauseIcon /> : <PlayArrowIcon />}
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                )}
                                {status.phase === 'BREAK' && (
                                    <Tooltip title="End break and start the next focus session">
                                        <span>
                                            <IconButton
                                                onClick={handleFinishBreak}
                                                aria-label="End break and start the next focus session"
                                                color="primary"
                                                size="large"
                                                sx={{
                                                    backgroundColor: 'action.hover',
                                                    '&:hover': { backgroundColor: 'action.selected' },
                                                }}
                                            >
                                                <SkipNextIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                )}
                                <Tooltip title="End Pomodoro session">
                                    <span>
                                        <IconButton
                                            onClick={handleEndSession}
                                            aria-label="End Pomodoro session"
                                            color="inherit"
                                            size="large"
                                            sx={{
                                                color: 'error.light',
                                                backgroundColor: 'action.hover',
                                                '&:hover': {
                                                    backgroundColor: alpha(theme.palette.error.main, 0.08),
                                                    color: 'error.main',
                                                },
                                            }}
                                        >
                                            <StopIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>
                        </Box>
                    </>
                )}
            </Stack>
            <Snackbar
                key={pomodoroFeedback?.id}
                open={pomodoroFeedback !== null}
                autoHideDuration={2000}
                onClose={(_, reason) => {
                    if (reason !== 'clickaway') setPomodoroFeedback(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                TransitionComponent={SlideFromRight}
                sx={{
                    right: { xs: 12, sm: 28 },
                    bottom: { xs: 12, sm: 28 },
                }}
            >
                {pomodoroFeedback ? (
                    <Alert
                        severity="error"
                        variant="outlined"
                        icon={<InfoOutlinedIcon fontSize="small" />}
                        onClose={() => setPomodoroFeedback(null)}
                        sx={{
                            position: 'relative',
                            minWidth: 190,
                            maxWidth: 'calc(100vw - 48px)',
                            boxSizing: 'border-box',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'background.paper',
                            px: 1.5,
                            pr: 5,
                            py: 0.5,
                            '& .MuiAlert-message': {
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                py: 0.25,
                                textAlign: 'center',
                                fontSize: '0.85rem',
                            },
                            '& .MuiAlert-action': {
                                position: 'absolute',
                                top: '50%',
                                right: 6,
                                p: 0,
                                m: 0,
                                transform: 'translateY(-50%)',
                            },
                        }}
                    >
                        {pomodoroFeedback.message}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </Box>
    );
}

export default PomodoroTimer;
