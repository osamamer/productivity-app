import type { PomodoroStatus } from '../../types/PomodoroStatus';

export function isFocusNavigationLocked(status: PomodoroStatus | null): boolean {
    return Boolean(status?.active
        && status.sessionActive
        && (status.phase === 'FOCUS' || (status.phase === undefined && status.sessionRunning)));
}
