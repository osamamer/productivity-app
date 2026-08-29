export type PomodoroTransition = 'FOCUS_ENDED' | 'BREAK_ENDED' | 'POMODORO_ENDED';

export interface PomodoroTransitionNotification {
    notificationId: string;
    taskId: string;
    taskName: string;
    transition: PomodoroTransition;
}
