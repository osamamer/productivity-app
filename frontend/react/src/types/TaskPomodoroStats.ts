export interface TaskPomodoroStats {
    taskId: string;
    totalFocusSeconds: number;
    totalFocusSessions: number;
    totalDaysWorked: number;
    currentStreakDays: number;
    longestStreakDays: number;
    lastWorkedOnDate: string | null;
}

export interface TodayFocusSummary {
    date: string;
    totalFocusSeconds: number;
}
