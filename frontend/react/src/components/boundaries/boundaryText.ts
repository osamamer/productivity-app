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

export function describeAppPause(settings: AppPauseSettings | null): string {
    if (!settings) return 'No pause';
    const parts = [`${formatDuration(settings.delaySeconds)} pause`];
    if (settings.closeAfterSeconds) parts.push(`closes after ${formatDuration(settings.closeAfterSeconds)}`);
    return parts.join(' · ');
}

export function describeSiteTimer(timer: Pick<SiteTimer, 'delaySeconds' | 'closeAfterSeconds'>): string {
    return `${formatDuration(timer.delaySeconds)} pause · Firefox closes after ${formatDuration(timer.closeAfterSeconds)}`;
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
