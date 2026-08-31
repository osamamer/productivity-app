export type PomodoroPhase = 'FOCUS' | 'BREAK' | 'WAITING_FOR_BREAK' | 'WAITING_FOR_FOCUS';

export interface PomodoroStatus {
    pomodoroId: string;
    associatedTaskId: string;
    active: boolean;
    sessionActive: boolean;
    sessionRunning: boolean;
    secondsPassedInSession: number;
    secondsUntilNextTransition: number;
    currentFocusNumber: number;
    numFocuses: number;
    phase?: PomodoroPhase;
}
