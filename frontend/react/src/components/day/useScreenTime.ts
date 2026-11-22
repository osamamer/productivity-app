import { useCallback, useState } from 'react';
import { desktopUsage, UsageRange, UsageSettings, UsageStatus } from '../../services/desktop';
import { useRevalidatingResource } from '../../hooks/useRevalidatingResource';
import {
    isSettledWindow,
    LIVE_REFRESH_MS,
    SCREEN_STATUS_KEY,
    screenRangeKey,
    screenRangeResource,
    screenStatusResource,
    STATUS_FRESH_MS,
} from '../../services/cache/screenTimeCache';

const noStatus = (): Promise<UsageStatus> => Promise.reject(new Error('Screen time is only in the desktop app.'));
const noRange = (): Promise<UsageRange> => Promise.reject(new Error('Screen time is only in the desktop app.'));

/**
 * Screen-time status and, given a time window, its data. Kept copies show at once; a window
 * that includes now is refreshed every minute. Does nothing outside the desktop app.
 */
export function useScreenTime(window?: { start: number; end: number }) {
    const status = useRevalidatingResource(
        screenStatusResource,
        desktopUsage ? SCREEN_STATUS_KEY : null,
        desktopUsage ? () => desktopUsage!.getStatus() : noStatus,
        { freshMs: STATUS_FRESH_MS },
    );
    // A save answers with the new status; it wins over the kept one until this view closes.
    const [savedStatus, setSavedStatus] = useState<UsageStatus | null>(null);
    const currentStatus = savedStatus ?? status.data;
    const enabled = currentStatus?.settings.enabled ?? false;
    const settled = window ? isSettledWindow(window.end) : true;
    const range = useRevalidatingResource(
        screenRangeResource,
        desktopUsage && enabled && window ? screenRangeKey(window.start, window.end) : null,
        desktopUsage && window ? () => desktopUsage!.getRange(window.start, window.end) : noRange,
        { freshMs: settled ? Infinity : 0, refreshEveryMs: settled ? undefined : LIVE_REFRESH_MS },
    );
    const [saveError, setSaveError] = useState<string | null>(null);

    const saveSettings = useCallback(async (settings: UsageSettings) => {
        if (!desktopUsage) return;
        setSaveError(null);
        try {
            const next = await desktopUsage.saveSettings(settings);
            screenStatusResource.set(SCREEN_STATUS_KEY, next);
            setSavedStatus(next);
        } catch (error) {
            console.error('Could not save screen-time settings:', error);
            setSaveError(error instanceof Error ? error.message : String(error));
        }
    }, []);

    const assignActivity = useCallback(async (appId: string, activityId: string | null) => {
        if (!desktopUsage?.assignActivity) return;
        setSaveError(null);
        try {
            const next = await desktopUsage.assignActivity(appId, activityId);
            screenStatusResource.set(SCREEN_STATUS_KEY, next);
            setSavedStatus(next);
        } catch (error) {
            console.error('Could not classify screen time:', error);
            setSaveError('Could not save the activity assignment.');
        }
    }, []);

    return {
        available: Boolean(desktopUsage),
        status: currentStatus,
        range: range.data,
        error: saveError ?? range.error ?? status.error,
        saveSettings,
        assignActivity: desktopUsage?.assignActivity ? assignActivity : undefined,
    };
}
