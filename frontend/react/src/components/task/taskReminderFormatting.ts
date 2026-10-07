export function formatReminderDateTime(value: Date | string): string {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';

    const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';

    return new Intl.DateTimeFormat(undefined, options).format(date);
}
