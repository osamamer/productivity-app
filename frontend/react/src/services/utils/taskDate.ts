function dateKeyFromDate(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

/**
 * Task schedule values are backend LocalDateTime strings. Keep their calendar
 * date instead of converting them to UTC, which can move midnight to another day.
 */
export function taskDateKey(value: string): string {
    const localDateTime = /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(value);
    const hasExplicitTimeZone = /T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
    if (localDateTime && !hasExplicitTimeZone) return localDateTime[1];

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : dateKeyFromDate(date);
}

export function dateKey(date: Date): string {
    return dateKeyFromDate(date);
}
