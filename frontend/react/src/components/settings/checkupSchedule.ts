

export const repeatCheckupNotificationsDescription = 'If you do not check in, remind you again every 30 minutes.';
export const DEFAULT_CHECKUP_INTERVAL_MINUTES = 180;
export const DEFAULT_CHECKUP_START_TIME = '09:00';

export const checkupIntervalOptions = [
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' },
    { value: 360, label: '6 hours' },
    { value: 480, label: '8 hours' },
    { value: 720, label: '12 hours' },
];

export function dateFromTime(value: string): Date {
    const match = /^(\d{2}):(\d{2})/.exec(value);
    const date = new Date();
    date.setHours(match ? Number(match[1]) : 9, match ? Number(match[2]) : 0, 0, 0);
    return date;
}

export function timeFromDate(value: Date): string {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function checkupTimesPerDay(intervalMinutes: number, startTime: string): number {
    const start = dateFromTime(startTime);
    const startMinute = start.getHours() * 60 + start.getMinutes();
    return Math.min(24, Math.floor((24 * 60 - startMinute) / intervalMinutes) + 1);
}
