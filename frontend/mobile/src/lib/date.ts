const pad = (value: number) => String(value).padStart(2, '0');

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateTime(date = new Date()): string {
  return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return 'No date';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatInTimeZone(value: string, timeZone: string | undefined, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { ...options, ...(timeZone ? { timeZone } : {}) }).format(date);
}

export function calendarDateParts(value: string | null | undefined, timeZone?: string): {
  weekday: string;
  month: string;
  day: string;
} | null {
  if (!value) return null;
  if (value.length === 10) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return {
      weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      month: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date),
      day: new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(date),
    };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    weekday: formatInTimeZone(value, timeZone, { weekday: 'short' }),
    month: formatInTimeZone(value, timeZone, { month: 'short' }),
    day: formatInTimeZone(value, timeZone, { day: 'numeric' }),
  };
}

export function formatCalendarDate(value: string | null | undefined, timeZone?: string): string {
  if (!value) return 'No date';
  if (value.length === 10) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  }
  return formatInTimeZone(value, timeZone, { weekday: 'short', month: 'short', day: 'numeric' }) || 'No date';
}

export function formatCalendarTime(value: string | null | undefined, timeZone?: string): string {
  if (!value) return '';
  return formatInTimeZone(value, timeZone, { hour: 'numeric', minute: '2-digit' });
}

export function localDateTimeToInstant(date: string, time: string): string | null {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime()) || localDate(parsed) !== date) return null;
  return parsed.toISOString();
}

export function eventDateInTimeZone(value: string | null | undefined, timeZone?: string): string {
  if (!value) return localDate();
  if (value.length === 10) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return localDate();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function secondsFromDuration(value: string | number | [number, number] | null): number {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value[0] * 86400 + value[1];
  if (!value) return 0;
  const match = value.match(/(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

export function clock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  return `${pad(minutes)}:${pad(safe % 60)}`;
}
