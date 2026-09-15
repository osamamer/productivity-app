import type { PomodoroFormValues } from '../api/pomodoroConfigService';
import type { PomodoroStatus } from '../../types/PomodoroStatus';

export type OptimisticPomodoroAction = 'toggle' | 'finish-break';

export function pomodoroDurationInSeconds(duration: number, secondsMode: boolean): number {
    return Math.max(0, Math.round(secondsMode ? duration : duration * 60));
}

function createOptimisticPomodoroId(): string {
    return `optimistic-pomodoro-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function breakDurationInSeconds(form: PomodoroFormValues, status: PomodoroStatus, secondsMode: boolean): number {
    const isLongBreak = status.currentFocusNumber % form.longBreakCooldown === 0;
    return pomodoroDurationInSeconds(
        isLongBreak ? form.longBreakDuration : form.shortBreakDuration,
        secondsMode,
    );
}

function startFocus(status: PomodoroStatus, form: PomodoroFormValues, secondsMode: boolean): PomodoroStatus {
    return {
        ...status,
        sessionActive: true,
        sessionRunning: true,
        secondsPassedInSession: 0,
        secondsUntilNextTransition: pomodoroDurationInSeconds(form.focusDuration, secondsMode),
        currentFocusNumber: Math.min(status.numFocuses, status.currentFocusNumber + 1),
        phase: 'FOCUS',
    };
}

export function createOptimisticPomodoroStatus(
    taskId: string,
    form: PomodoroFormValues,
    secondsMode: boolean,
): PomodoroStatus {
    return {
        pomodoroId: createOptimisticPomodoroId(),
        associatedTaskId: taskId,
        active: true,
        sessionActive: true,
        sessionRunning: true,
        secondsPassedInSession: 0,
        secondsUntilNextTransition: pomodoroDurationInSeconds(form.focusDuration, secondsMode),
        currentFocusNumber: 1,
        numFocuses: form.numFocuses,
        completedFocusSessions: 0,
        totalFocusSeconds: 0,
        phase: 'FOCUS',
    };
}

export function getOptimisticPomodoroStatus(
    status: PomodoroStatus,
    action: OptimisticPomodoroAction,
    form: PomodoroFormValues,
    secondsMode: boolean,
): PomodoroStatus | null {
    if (!status.active) return null;

    if (action === 'finish-break') {
        if (status.phase !== 'BREAK') return null;
        return startFocus(status, form, secondsMode);
    }

    if (status.phase === 'WAITING_FOR_BREAK') {
        return {
            ...status,
            sessionActive: false,
            sessionRunning: false,
            secondsPassedInSession: 0,
            secondsUntilNextTransition: breakDurationInSeconds(form, status, secondsMode),
            phase: 'BREAK',
        };
    }

    if (status.phase === 'WAITING_FOR_FOCUS') {
        return startFocus(status, form, secondsMode);
    }

    return {
        ...status,
        sessionActive: true,
        sessionRunning: !status.sessionRunning,
    };
}

export function createOptimisticCompletedPomodoroStatus(status: PomodoroStatus): PomodoroStatus {
    const completedFocusSessions = (status.completedFocusSessions ?? 0)
        + (status.sessionActive ? 1 : 0);
    const totalFocusSeconds = (status.totalFocusSeconds ?? 0)
        + (status.sessionActive ? Math.max(0, status.secondsPassedInSession) : 0);

    return {
        ...status,
        active: false,
        sessionActive: false,
        sessionRunning: false,
        secondsPassedInSession: 0,
        secondsUntilNextTransition: 0,
        completedFocusSessions,
        totalFocusSeconds,
        phase: 'COMPLETED',
    };
}
