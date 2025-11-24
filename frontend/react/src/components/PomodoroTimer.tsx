import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
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
} from '@mui/material';
import { HoverCardBox } from './box/HoverCardBox';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import TimerIcon from '@mui/icons-material/Timer';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import { taskService } from '../services/api'; // Import the service

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
}

interface PomodoroFormData {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    numFocuses: number;
    longBreakCooldown: number;
}

interface Props {
    task: Task | null;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

export function PomodoroTimer({ task }: Props) {
    const [status, setStatus] = useState<Pomodoro | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const stompClientRef = useRef<Client | null>(null);

    const [formData, setFormData] = useState<PomodoroFormData>({
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        numFocuses: 4,
        longBreakCooldown: 4
    });

    const handleTogglePlayPause = async () => {
        if (!task) return;

        setIsLoading(true);
        try {
            if (status?.sessionRunning) {
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

    const connectWebSocket = useCallback(() => {
        if (stompClientRef.current?.active) {
            console.log('STOMP client already active');
            return;
        }

        console.log('Creating new STOMP client...');
        const client = new Client({
            brokerURL: WS_URL,
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

            if (task?.taskId) {
                subscribeToTask(task.taskId);
            }
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
    }, [task?.taskId]);

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
            console.log('Starting pomodoro with data:', formData);
            await taskService.startPomodoro(
                task.taskId,
                formData.focusDuration,
                formData.shortBreakDuration,
                formData.longBreakDuration,
                formData.numFocuses,
                formData.longBreakCooldown
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
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const isBreakTime = () => {
        if (status) {
            return !status.sessionActive;
        }
        return true;
    };

    const getProgressPercentage = () => {
        if (!status) return 0;
        const total = status.secondsPassedInSession + status.secondsUntilNextTransition;
        return total > 0 ? (status.secondsPassedInSession / total) * 100 : 0;
    };

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
                                label="Focus (min)"
                                type="number"
                                size="small"
                                value={formData.focusDuration}
                                onChange={handleInputChange}
                                disabled={isLoading}
                            />
                            <TextField
                                name="shortBreakDuration"
                                label="Short Break (min)"
                                type="number"
                                size="small"
                                value={formData.shortBreakDuration}
                                onChange={handleInputChange}
                                disabled={isLoading}
                            />
                            <TextField
                                name="longBreakDuration"
                                label="Long Break (min)"
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
                                        {formatTime(status.secondsUntilNextTransition)}
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
                                label={isBreakTime() ? 'Break Time' : 'Focus Time'}
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

                            {/* Controls */}
                            {status.sessionActive && (
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                    <IconButton
                                        onClick={handleTogglePlayPause}
                                        color="primary"
                                        size="large"
                                        disabled={isLoading}
                                        sx={{
                                            backgroundColor: 'action.hover',
                                            '&:hover': {
                                                backgroundColor: 'action.selected',
                                            },
                                        }}
                                    >
                                        {status.sessionRunning ? <PauseIcon /> : <PlayArrowIcon />}
                                    </IconButton>
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
                            )}
                        </Box>
                    </>
                )}
            </Stack>
        </Box>
    );
}

export default PomodoroTimer;