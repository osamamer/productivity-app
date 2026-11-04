import type { PomodoroStatus } from '../../types/PomodoroStatus';

export function getPomodoroProgressPercentage(status: Pick<PomodoroStatus, 'secondsPassedInSession' | 'secondsUntilNextTransition'> | null): number {
    if (!status) return 0;

    const passed = Math.max(0, status.secondsPassedInSession);
    const remaining = Math.max(0, status.secondsUntilNextTransition);
    const total = passed + remaining;
    return total > 0 ? Math.min(100, (passed / total) * 100) : 0;
}
