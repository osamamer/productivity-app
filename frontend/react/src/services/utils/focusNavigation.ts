import type { PomodoroStatus } from '../../types/PomodoroStatus';

/** Pages stay put only while focus time is ticking; a paused focus or a break frees navigation. */
export function isFocusNavigationLocked(status: PomodoroStatus | null): boolean {
    return Boolean(status?.active
        && status.sessionActive
        && status.sessionRunning
        && (status.phase === 'FOCUS' || status.phase === undefined));
}
