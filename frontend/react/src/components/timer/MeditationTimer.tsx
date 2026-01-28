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
import { HoverCardBox } from '../box/HoverCardBox.tsx';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import TimerIcon from '@mui/icons-material/Timer';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import { taskService } from '../../services/api/index.ts';
import CustomTimer from "./CustomTimer.tsx"; // Import the service

interface Task {
    taskId: string;
    name: string;
}

interface Props {
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

export function MeditationTimer({  }: Props) {
    return (
        <CustomTimer/>
    );
}

export default MeditationTimer;