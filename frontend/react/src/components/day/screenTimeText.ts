import { format } from 'date-fns';

/** "45m", "1h 20m", "under 1m": rounded to minutes, because seconds add noise, not insight. */
export function formatScreenDuration(ms: number): string {
    const minutes = Math.round(ms / 60_000);
    if (minutes < 1) return 'under 1m';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest}m`;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatTimeRange(start: number, end: number): string {
    return `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
}
