export interface Session   {
    sessionId: number;
    taskId: number;
    isRunning: boolean;
    isActive: boolean;
    totalSessionTime: number;
    startTime: string;
    lastUnpauseTime: string;
    lastPauseTime: string;
    endTime: string;
    pomodoro: boolean;
}