import { useCallback, useEffect, useState } from 'react';
import { desktopUsage, UsageRange, UsageSettings, UsageStatus } from '../../services/desktop';

const REFRESH_MS = 60_000;

/**
 * Screen-time status and, given a time window, its data, refreshed every minute while the
 * window includes now. Does nothing outside the desktop app.
 */
export function useScreenTime(window?: { start: number; end: number }) {
    const windowStart = window?.start;
    const windowEnd = window?.end;
    const [status, setStatus] = useState<UsageStatus | null>(null);
    const [range, setRange] = useState<UsageRange | null>(null);
    const [error, setError] = useState<string | null>(null);
    const enabled = status?.settings.enabled ?? false;

    useEffect(() => {
        if (!desktopUsage) return;
        desktopUsage.getStatus()
            .then(setStatus)
            .catch((statusError: Error) => {
                console.error('Could not read screen-time status:', statusError);
                setError(statusError.message);
            });
    }, []);

    useEffect(() => {
        if (!desktopUsage || !enabled || windowStart === undefined || windowEnd === undefined) return undefined;
        let cancelled = false;
        const load = () => desktopUsage?.getRange(windowStart, windowEnd)
            .then(next => {
                if (!cancelled) setRange(next);
            })
            .catch((rangeError: Error) => {
                console.error('Could not read screen time:', rangeError);
                if (!cancelled) setError(rangeError.message);
            });
        void load();
        const live = Date.now() < windowEnd;
        const timer = live ? setInterval(load, REFRESH_MS) : undefined;
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [enabled, windowStart, windowEnd]);

    const saveSettings = useCallback(async (settings: UsageSettings) => {
        if (!desktopUsage) return;
        setError(null);
        try {
            setStatus(await desktopUsage.saveSettings(settings));
        } catch (saveError) {
            console.error('Could not save screen-time settings:', saveError);
            setError(saveError instanceof Error ? saveError.message : String(saveError));
        }
    }, []);

    return { available: Boolean(desktopUsage), status, range, error, saveSettings };
}
