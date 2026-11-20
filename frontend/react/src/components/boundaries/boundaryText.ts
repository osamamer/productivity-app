import type { AppPauseSettings, SiteTimer } from '../../services/desktop';

export const DEFAULT_PAUSE_MESSAGE = 'Take a breath.';

/** "45 s", "2 min", "1 h 30 min": short durations for list summaries. */
export function formatDuration(totalSeconds: number): string {
    if (totalSeconds < 60) return `${totalSeconds} s`;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);
    if (!hours) return `${minutes} min`;
    return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

/** "1 h a day · 20 min left", or "Done for today" once the limit is used up; null without a limit. */
export function describeDailyLimit(limitSeconds: number | undefined, usedSeconds = 0): string | null {
    if (!limitSeconds) return null;
    const left = limitSeconds - usedSeconds;
    if (left <= 0) return 'Done for today';
    return `${formatDuration(limitSeconds)} a day · ${formatDuration(Math.ceil(left))} left`;
}

export function describeAppPause(settings: AppPauseSettings | null, usedTodaySeconds = 0): string {
    if (!settings) return 'No pause';
    const parts: string[] = [];
    const daily = describeDailyLimit(settings.dailyLimitSeconds, usedTodaySeconds);
    if (settings.delaySeconds || !daily) parts.push(`${formatDuration(settings.delaySeconds)} pause`);
    if (settings.closeAfterSeconds) parts.push(`closes after ${formatDuration(settings.closeAfterSeconds)}`);
    if (daily) parts.push(daily);
    return parts.join(' · ');
}

type SiteTimerSummary = Pick<SiteTimer, 'delaySeconds' | 'closeAfterSeconds'> & Partial<Pick<SiteTimer, 'dailyLimitSeconds' | 'usedTodaySeconds'>>;

export function describeSiteTimer(timer: SiteTimerSummary): string {
    const parts = [`${formatDuration(timer.delaySeconds)} pause`, `Firefox closes after ${formatDuration(timer.closeAfterSeconds)}`];
    const daily = describeDailyLimit(timer.dailyLimitSeconds, timer.usedTodaySeconds);
    if (daily) parts.push(daily);
    return parts.join(' · ');
}

/** The address as the user typed it, without the scheme and trailing slash the shell adds. */
export function displayUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Parses a whole number from a text field, or null when it is empty or out of range. */
export function parseWholeNumber(value: string, min: number, max: number): number | null {
    if (!/^\d+$/.test(value.trim())) return null;
    const number = Number(value);
    return number >= min && number <= max ? number : null;
}
