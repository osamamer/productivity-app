import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import keycloak from '../../services/keycloak';
import {
    Box,
    Button,
    TextField,
    Typography,
    Stack,
    Alert,
    IconButton,
    CircularProgress,
    Chip,
    Tooltip,
} from '@mui/material';
import { HoverCardBox } from '../box/HoverCardBox.tsx';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import TimerIcon from '@mui/icons-material/Timer';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { taskService } from '../../services/api/index.ts'; // Import the service
import { requestSystemNotificationPermission } from '../../services/systemNotifications';
import {
    createPomodoroFormDefaults,
    getPomodoroConfig,
    isPomodoroFormDefaults,
    NORMAL_POMODORO_CONFIG,
    PomodoroConfig,
    PomodoroFormValues,
} from '../../services/api/pomodoroConfigService';

interface Task {
    taskId: string;
    name: string;
}

interface Pomodoro {
    taskId: string;
    taskName: string;
    active: boolean;
    sessionActive: boolean;
    sessionRunning: boolean;
    secondsPassedInSession: number;
    secondsUntilNextTransition: number;
    currentFocusNumber: number;
    numFocuses: number;
    phase?: 'FOCUS' | 'BREAK' | 'WAITING_FOR_BREAK' | 'WAITING_FOR_FOCUS';
}

interface Props {
    task: Task | null;
    onActiveChange?: (active: boolean) => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

export function PomodoroTimer({ task, onActiveChange }: Props) {
    const [status, setStatus] = useState<Pomodoro | null>(null);
    const [pomodoroConfig, setPomodoroConfig] = useState<PomodoroConfig>(NORMAL_POMODORO_CONFIG);

    useEffect(() => {
        onActiveChange?.(Boolean(status?.active));
    }, [status?.active, onActiveChange]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const stompClientRef = useRef<Client | null>(null);

    const [formData, setFormData] = useState<PomodoroFormValues>(() =>
        createPomodoroFormDefaults(NORMAL_POMODORO_CONFIG)
    );

    const waitingForPhase = status?.phase === 'WAITING_FOR_BREAK' || status?.phase === 'WAITING_FOR_FOCUS';
    const isBreakPhase = status?.phase
        ? status.phase === 'BREAK' || status.phase === 'WAITING_FOR_BREAK'
        : Boolean(status && !status.sessionActive);

    useEffect(() => {
        let cancelled = false;
        getPomodoroConfig()
            .then(config => {
                if (cancelled) return;
                setPomodoroConfig(config);
                setFormData(previous =>
                    isPomodoroFormDefaults(previous, NORMAL_POMODORO_CONFIG)
                        ? createPomodoroFormDefaults(config)
                        : previous
                );
            })
            .catch(error => console.error('Failed to load Pomodoro configuration:', error));

        return () => {
            cancelled = true;
        };
    }, []);

    const handleTogglePlayPause = async () => {
        if (!task) return;

        setIsLoading(true);
        try {
            if (waitingForPhase) {
                await taskService.startNextPomodoroPhase(task.taskId);
            } else if (status?.sessionRunning) {
                await taskService.pauseSession(task.taskId);
            } else {
                await taskService.unpauseSession(task.taskId);
            }
        } catch (error) {
            console.error('Error toggling play/pause:', error);
            setConnectionError(error instanceof Error ? error.message : 'Failed to toggle session');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEndSession = async () => {
        if (!task) return;

        setIsLoading(true);
        try {
            await taskService.endPomodoro(task.taskId);
            setStatus(null);
        } catch (error) {
            console.error('Error ending session:', error);
            setConnectionError(error instanceof Error ? error.message : 'Failed to end session');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinishBreak = async () => {
        if (!task) return;

        setIsLoading(true);
        try {
            await taskService.finishPomodoroBreak(task.taskId);
        } catch (error) {
            console.error('Error ending Pomodoro break:', error);
            setConnectionError(error instanceof Error ? error.message : 'Failed to end break');
        } finally {
            setIsLoading(false);
        }
    };

    const connectWebSocket = useCallback(() => {
        if (stompClientRef.current?.active) {
            console.log('STOMP client already active');
            return;
        }

        console.log('Creating new STOMP client...');
        const client = new Client({
            brokerURL: WS_URL,
            connectHeaders: {
                Authorization: `Bearer ${keycloak.token ?? ''}`,
            },
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            connectionTimeout: 10000,
            onStompError: (frame) => {
                console.error('STOMP protocol error:', frame);
                setConnectionError(`STOMP error: ${frame.headers?.message || 'Unknown error'}`);
                setIsConnected(false);
            }
        });

        client.onConnect = (frame) => {
            console.log('STOMP Client Connected:', frame);
            setIsConnected(true);
            setConnectionError(null);
        };

        client.onDisconnect = () => {
            console.log('STOMP Client Disconnected');
            setIsConnected(false);
        };

        client.onWebSocketError = (error) => {
            console.error('WebSocket Error:', error);
            setConnectionError('Failed to connect to WebSocket server');
            setIsConnected(false);
        };

        stompClientRef.current = client;

        try {
            console.log('Activating STOMP client...');
            client.activate();
        } catch (error) {
            console.error('Error activating STOMP client:', error);
            setConnectionError(`Failed to activate STOMP client: ${error}`);
        }

        return () => {
            if (client.active) {
                console.log('Deactivating STOMP client...');
                client.deactivate();
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
                    const newStatus: Pomodoro = JSON.parse(message.body);
                    setStatus(newStatus);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });
        } catch (error) {
            console.error('Error subscribing to task:', error);
            setConnectionError(`Failed to subscribe: ${error}`);
        }
    }, []);

    useEffect(() => {
        if (task?.taskId && isConnected) {
            const subscription = subscribeToTask(task.taskId);
            return () => {
                subscription?.unsubscribe();
            };
        }
    }, [task?.taskId, isConnected, subscribeToTask]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData(prev => ({
            ...prev,
            [name]: Number(value)
        }));
    };

    const startPomodoro = async () => {
        if (!task) {
            setConnectionError('No task selected');
            return;
        }

        if (!isConnected) {
            setConnectionError('Cannot start Pomodoro: WebSocket not connected');
            return;
        }

        setIsLoading(true);
        try {
            try {
                await requestSystemNotificationPermission();
            } catch (error) {
                console.error('Failed to request Pomodoro notification permission:', error);
            }
            console.log('Starting pomodoro with data:', formData);
            await taskService.startPomodoro(
                task.taskId,
                formData.focusDuration,
                formData.shortBreakDuration,
                formData.longBreakDuration,
                formData.numFocuses,
                formData.longBreakCooldown,
                pomodoroConfig.secondsMode
            );
            console.log('Pomodoro started successfully');
        } catch (error) {
            console.error('Error starting pomodoro:', error);
            setConnectionError(error instanceof Error ? error.message : 'Failed to start pomodoro');
        } finally {
            setIsLoading(false);
        }
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
                {connectionError && (
                    <Alert severity="error" onClose={() => setConnectionError(null)}>
                        {connectionError}
                    </Alert>
                )}

                {!status?.active ? (
                    <>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ mb: 2 }} variant="h5" gutterBottom>
                                Pomodoro Timer
                            </Typography>
                            <TimerIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField
                                name="focusDuration"
                                label={`Focus (${durationUnitLabel})`}
                                type="number"
                                size="small"
                                value={formData.focusDuration}
                                onChange={handleInputChange}
                                disabled={isLoading}
                            />
                            <TextField
                                name="shortBreakDuration"
                                label={`Short Break (${durationUnitLabel})`}
                                type="number"
                                size="small"
                                value={formData.shortBreakDuration}
                                onChange={handleInputChange}
                                disabled={isLoading}
                            />
                            <TextField
                                name="longBreakDuration"
                                label={`Long Break (${durationUnitLabel})`}
                                type="number"
                                size="small"
                                value={formData.longBreakDuration}
                                onChange={handleInputChange}
                                disabled={isLoading}
                            />
                            <TextField
                                name="numFocuses"
                                label="Focus Sessions"
                                type="number"
                                size="small"
                                value={formData.numFocuses}
                                onChange={handleInputChange}
                                disabled={isLoading}
                            />
                        </Box>

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={startPomodoro}
                            disabled={!isConnected || isLoading}
                            fullWidth
                            startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                        >
                            {isLoading ? 'Starting...' : !isConnected ? 'Connecting...' : 'Start Session'}
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
                                        color: isBreakTime() ? '#4caf50' : 'primary.main',
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
                                        <FreeBreakfastIcon sx={{ fontSize: 32, color: '#4caf50', mb: 1 }} />
                                    ) : (
                                        <TimerIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                                    )}
                                    <Typography variant="h3" component="div" fontWeight="bold">
                                        {waitingForPhase ? 'Ready' : formatTime(status.secondsUntilNextTransition)}
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
                                {status.taskName || task.name}
                            </Typography>

                            {/* Status Chip */}
                            <Chip
                                label={waitingForPhase
                                    ? (status.phase === 'WAITING_FOR_BREAK' ? 'Break Ready' : 'Focus Ready')
                                    : isBreakTime() ? 'Break Time' : 'Focus Time'}
                                color={isBreakTime() ? 'success' : 'primary'}
                                icon={isBreakTime() ? <FreeBreakfastIcon /> : <TimerIcon />}
                                sx={{ mb: 2 }}
                            />

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
                                {(status.sessionActive || waitingForPhase) && (
                                    <IconButton
                                        onClick={handleTogglePlayPause}
                                        color="primary"
                                        size="large"
                                        disabled={isLoading}
                                        sx={{
                                            backgroundColor: 'action.hover',
                                            '&:hover': { backgroundColor: 'action.selected' },
                                        }}
                                    >
                                        {!waitingForPhase && status.sessionRunning ? <PauseIcon /> : <PlayArrowIcon />}
                                    </IconButton>
                                )}
                                {status.phase === 'BREAK' && (
                                    <Tooltip title="End break and start the next focus session">
                                        <span>
                                            <IconButton
                                                onClick={handleFinishBreak}
                                                color="success"
                                                size="large"
                                                disabled={isLoading}
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
                                <IconButton
                                    onClick={handleEndSession}
                                    color="error"
                                    size="large"
                                    disabled={isLoading}
                                    sx={{
                                        backgroundColor: 'action.hover',
                                        '&:hover': {
                                            backgroundColor: 'error.light',
                                            color: 'error.contrastText',
                                        },
                                    }}
                                >
                                    <StopIcon />
                                </IconButton>
                            </Box>
                        </Box>
                    </>
                )}
            </Stack>
        </Box>
    );
}

export default PomodoroTimer;
