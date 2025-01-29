import React, { useState, useEffect } from 'react';
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
    Stack, SelectChangeEvent
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
    const [stompClient, setStompClient] = useState<Client | null>(null);
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
    const DAY_URL = ROOT_URL.concat("/api/v1/day");

    useEffect(() => {
        fetch(TASK_URL.concat('/get-today-tasks'))
            .then(response => response.json())
            .then(data => setTasks(data));

        const client = new Client({
            brokerURL: 'ws://localhost:8080/ws',
            debug: function (str) {
                console.log(str);
            },
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000
        });

        client.onConnect = () => {
            if (formData.taskId) {
                subscribeToTask(client, formData.taskId);
            }
        };

        client.activate();
        setStompClient(client);

        return () => {
            client.deactivate();
        };
    }, []);

    const subscribeToTask = (client: Client, taskId: string) => {
        client.subscribe(`/topic/pomodoro/${taskId}`, (message) => {
            const newStatus: PomodoroStatus = JSON.parse(message.body);
            setStatus(newStatus);
        });
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleTaskChange = (event: SelectChangeEvent) => {
        const taskId = event.target.value as string;
        setFormData(prev => ({
            ...prev,
            taskId
        }));

        if (stompClient?.connected) {
            subscribeToTask(stompClient, taskId);
        }
    };

    const startPomodoro = async () => {
        try {
            await fetch(TASK_URL.concat('/start-pomodoro'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
        } catch (error) {
            console.error('Error starting pomodoro:', error);
        }
    };

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <HoverCardBox>
            <Stack spacing={2} sx={{ width: '100%' }}>
                {!status?.isSessionActive ? (
                    <>
                        <Typography variant="h6">
                            Pomodoro Timer
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
                            disabled={!formData.taskId}
                            fullWidth
                            size="small"
                        >
                            Start Pomodoro
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