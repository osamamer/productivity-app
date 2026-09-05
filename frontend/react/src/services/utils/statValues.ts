const MINUTES_PER_DAY = 24 * 60;

export function timeValueToMinutes(value: string): number | null {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const totalMinutes = hours * 60 + minutes;
    return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
        ? totalMinutes
        : null;
}

export function minutesToTimeValue(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '';

    const rounded = Math.round(value);
    if (rounded < 0 || rounded >= MINUTES_PER_DAY) return '';

    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatTimeValue(value: number | undefined): string {
    if (value != null && Number.isFinite(value) && Math.round(value) === MINUTES_PER_DAY) {
        return '24:00';
    }
    const formatted = minutesToTimeValue(value);
    return formatted || '—';
}

export function durationValueToMinutes(value: string): number | null {
    const match = /^(\d+):([0-5]\d)$/.exec(value.trim());
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const totalMinutes = hours * 60 + minutes;
    return Number.isSafeInteger(totalMinutes) ? totalMinutes : null;
}

export function minutesToDurationValue(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value) || value < 0) return '';

    const rounded = Math.round(value);
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export function formatDurationValue(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value) || value < 0) return '—';

    const rounded = Math.round(value);
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    if (hours === 0) return `${minutes}m`;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
