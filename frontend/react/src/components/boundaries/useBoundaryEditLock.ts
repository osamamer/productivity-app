import { useCallback, useEffect, useState } from 'react';
import type { BoundaryEditStatus, DesktopTimeouts } from '../../services/desktop';

export interface BoundaryEditLock {
    // False in desktop builds that predate the password; those edit freely.
    supported: boolean;
    status: BoundaryEditStatus | null;
    editable: boolean;
    setPassword: (password: string) => Promise<void>;
    unlock: (password: string) => Promise<void>;
    lock: () => Promise<void>;
}

export function isEditable(status: BoundaryEditStatus | null, now: number): boolean {
    return Boolean(status?.hasPassword && status.readyAt <= now && now < status.unlockedUntil);
}

/**
 * The desktop shell's password-and-wait lock on Boundaries. The shell enforces it; this mirrors
 * it so the page can disable its controls, and locks again when the page closes.
 */
export function useBoundaryEditLock(timeouts: DesktopTimeouts): BoundaryEditLock {
    const supported = Boolean(timeouts.editStatus);
    const [status, setStatus] = useState<BoundaryEditStatus | null>(null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!timeouts.editStatus) return undefined;
        timeouts.editStatus().then(setStatus).catch(error => console.error('Could not read the Boundaries lock:', error));
        return () => {
            void timeouts.lockEditing?.().catch(error => console.error('Could not lock Boundaries again:', error));
        };
    }, [timeouts]);

    // Re-render when the wait ends and when the unlock lapses.
    useEffect(() => {
        if (!status) return undefined;
        const upcoming = [status.readyAt, status.unlockedUntil].filter(time => time > now);
        if (!upcoming.length) return undefined;
        const timer = window.setTimeout(() => setNow(Date.now()), Math.min(...upcoming) - now + 20);
        return () => window.clearTimeout(timer);
    }, [status, now]);

    const apply = useCallback((next: BoundaryEditStatus) => {
        setStatus(next);
        setNow(Date.now());
    }, []);

    const setPassword = useCallback(async (password: string) => {
        if (timeouts.setEditPassword) apply(await timeouts.setEditPassword(password));
    }, [timeouts, apply]);
    const unlock = useCallback(async (password: string) => {
        if (timeouts.unlockEditing) apply(await timeouts.unlockEditing(password));
    }, [timeouts, apply]);
    const lock = useCallback(async () => {
        if (timeouts.lockEditing) apply(await timeouts.lockEditing());
    }, [timeouts, apply]);

    return { supported, status, editable: !supported || isEditable(status, now), setPassword, unlock, lock };
}
