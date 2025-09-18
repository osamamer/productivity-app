import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import {
    Box,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Typography,
    LinearProgress,
    Stack,
    SelectChangeEvent,
    Alert
} from '@mui/material';
import { HoverCardBox } from './HoverCardBox';

interface Task {
    taskId: string;
    name: string;
}

interface PomodoroStatus {
    taskId: string;
    taskName: string;
    isSessionActive: boolean;
    secondsUntilTransition: number;
    currentFocusNumber: number;
    totalFocuses: number;
}

interface PomodoroFormData {
    taskId: string;
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    numFocuses: number;
    longBreakCooldown: number;
}

const PomodoroTimer: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [status, setStatus] = useState<PomodoroStatus | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const stompClientRef = useRef<Client | null>(null);
    const [formData, setFormData] = useState<PomodoroFormData>({
        taskId: '',
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        numFocuses: 4,
        longBreakCooldown: 4
    });

    const ROOT_URL = "http://localhost:8080";
    const TASK_URL = ROOT_URL.concat("/api/v1/task");
    const WS_URL = `ws://localhost:8080/ws`;

    const connectWebSocket = useCallback(() => {
        if (stompClientRef.current?.active) {
            console.log('STOMP client already active');
            return;
        }

        console.log('Creating new STOMP client...');
        const client = new Client({
            brokerURL: WS_URL,
            debug: (str) => {
                console.log('STOMP Debug:', str);
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

            if (formData.taskId) {
                subscribeToTask(formData.taskId);
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
    }, [formData.taskId]);

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
                console.log('Received message:', message.body);
                try {
                    const newStatus: PomodoroStatus = JSON.parse(message.body);
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
        const fetchTasks = async () => {
            try {
                console.log('Fetching tasks...');
                const response = await fetch(TASK_URL.concat('/get-today-tasks'));
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                console.log('Tasks fetched:', data);
                setTasks(data);
            } catch (error) {
                console.error('Error fetching tasks:', error);
            }
        };

        fetchTasks();
    }, []);

    useEffect(() => {
        if (formData.taskId && isConnected) {
            const subscription = subscribeToTask(formData.taskId);
            return () => {
                subscription?.unsubscribe();
            };
        }
    }, [formData.taskId, isConnected, subscribeToTask]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData(prev => ({
            ...prev,
            [name]: Number(value)
        }));
    };

    const handleTaskChange = (event: SelectChangeEvent) => {
        const taskId = event.target.value as string;
        console.log('Task changed to:', taskId);
        setFormData(prev => ({
            ...prev,
            taskId
        }));
    };

    const startPomodoro = async () => {
        if (!isConnected) {
            setConnectionError('Cannot start Pomodoro: WebSocket not connected');
            return;
        }

        try {
            console.log('Starting pomodoro with data:', formData);
            const response = await fetch(TASK_URL.concat('/start-pomodoro'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('Pomodoro started successfully');
        } catch (error) {
            console.error('Error starting pomodoro:', error);
            setConnectionError(`Failed to start pomodoro: ${error}`);
        }
    };

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <HoverCardBox
            display={(theme) => ({
                display: "none",
                [theme.breakpoints.up("lg")]: { display: "block" },
            })}>
            <Stack spacing={2} sx={{ width: '100%' }}>
                {connectionError && (
                    <Alert severity="error" onClose={() => setConnectionError(null)}>
                        {connectionError}
                    </Alert>
                )}

                {!status?.isSessionActive ? (
                    <>
                        <Typography variant="h6">
                            Pomodoro Timer {isConnected ? '(Connected)' : '(Disconnected)'}
                        </Typography>

                        <FormControl size="small" fullWidth>
                            <InputLabel>Select Task</InputLabel>
                            <Select
                                value={formData.taskId}
                                onChange={handleTaskChange}
                                label="Select Task"
                                variant="standard">
                                {tasks.map((task) => (
                                    <MenuItem key={task.taskId} value={task.taskId}>
                                        {task.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField
                                name="focusDuration"
                                label="Focus (min)"
                                type="number"
                                size="small"
                                value={formData.focusDuration}
                                onChange={handleInputChange}
                            />

                            <TextField
                                name="shortBreakDuration"
                                label="Short Break (min)"
                                type="number"
                                size="small"
                                value={formData.shortBreakDuration}
                                onChange={handleInputChange}
                            />

                            <TextField
                                name="longBreakDuration"
                                label="Long Break (min)"
                                type="number"
                                size="small"
                                value={formData.longBreakDuration}
                                onChange={handleInputChange}
                            />

                            <TextField
                                name="numFocuses"
                                label="Focus Sessions"
                                type="number"
                                size="small"
                                value={formData.numFocuses}
                                onChange={handleInputChange}
                            />
                        </Box>

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={startPomodoro}
                            disabled={!formData.taskId || !isConnected}
                            fullWidth
                            size="small"
                        >
                            Start Pomodoro {!isConnected ? '(Waiting for connection...)' : ''}
                        </Button>
                    </>
                ) : (
                    <>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="subtitle1" gutterBottom>
                                {status.taskName}
                            </Typography>

                            <Typography variant="h4">
                                {formatTime(status.secondsUntilTransition)}
                            </Typography>

                            <Box sx={{ width: '100%', mt: 1 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={(status.currentFocusNumber / status.totalFocuses) * 100}
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Session {status.currentFocusNumber} of {status.totalFocuses}
                                </Typography>
                            </Box>
                        </Box>
                    </>
                )}
            </Stack>
        </HoverCardBox>
    );
};

export default PomodoroTimer;