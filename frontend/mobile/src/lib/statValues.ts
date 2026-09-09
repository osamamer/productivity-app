const MINUTES_PER_DAY = 24 * 60;
export const BEDTIME_SCALE_START_MINUTES = 20 * 60;

export interface TimeDisplayScale {
  startMinutes: number;
  durationMinutes: number;
  label: string;
}

const SLEEP_TIME_DISPLAY_SCALE: TimeDisplayScale = {
  startMinutes: 22 * 60,
  durationMinutes: 9 * 60,
  label: '10 PM–7 AM',
};
const WAKE_UP_TIME_DISPLAY_SCALE: TimeDisplayScale = {
  startMinutes: 7 * 60,
  durationMinutes: 7 * 60,
  label: '7 AM–2 PM',
};

export interface TimeStatIdentity {
  systemKey?: string;
}

export function usesBedtimeScale(definition: TimeStatIdentity): boolean {
  return definition.systemKey === 'sleep_time';
}

export function getTimeDisplayScale(definition: TimeStatIdentity): TimeDisplayScale | null {
  if (definition.systemKey === 'sleep_time') return SLEEP_TIME_DISPLAY_SCALE;
  if (definition.systemKey === 'wake_up_time') return WAKE_UP_TIME_DISPLAY_SCALE;
  return null;
}

export function timeDisplayScaleMaximum(definition: TimeStatIdentity): number {
  return getTimeDisplayScale(definition)?.durationMinutes ?? MINUTES_PER_DAY;
}

export function timeValueToDisplayScale(definition: TimeStatIdentity, value: number): number {
  const scale = getTimeDisplayScale(definition);
  if (!scale) return value;

  const relativeValue = (value - scale.startMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.max(0, Math.min(scale.durationMinutes, relativeValue));
}

export function timeValueFromDisplayScale(definition: TimeStatIdentity, value: number): number {
  const scale = getTimeDisplayScale(definition);
  if (!scale) return value;
  return (value + scale.startMinutes) % MINUTES_PER_DAY;
}

export function timeDisplayScaleTicks(definition: TimeStatIdentity): number[] {
  const scale = getTimeDisplayScale(definition);
  if (!scale) return [0, 4 * 60, 8 * 60, 12 * 60, 16 * 60, 20 * 60, MINUTES_PER_DAY];
  if (definition.systemKey === 'sleep_time') return [0, 3 * 60, 6 * 60, scale.durationMinutes];
  return [0, 2 * 60, 4 * 60, 6 * 60, scale.durationMinutes];
}

export function timeDisplayScaleLabel(definition: TimeStatIdentity): string | null {
  return getTimeDisplayScale(definition)?.label ?? null;
}

export function timeValueToScale(definition: TimeStatIdentity, value: number): number {
  if (!usesBedtimeScale(definition)) return value;
  return (value - BEDTIME_SCALE_START_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function timeValueFromScale(definition: TimeStatIdentity, value: number): number {
  if (!usesBedtimeScale(definition)) return value;
  return (value + BEDTIME_SCALE_START_MINUTES) % MINUTES_PER_DAY;
}

export function formatTimeCircleValue(
  definition: TimeStatIdentity,
  value: number | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return '—';

  if (value < 0 || value > MINUTES_PER_DAY) return '—';

  const hour24 = Math.round(value / 60) % 24;
  const uses12HourClock = definition.systemKey === 'sleep_time'
    || definition.systemKey === 'wake_up_time';
  return String(uses12HourClock ? hour24 % 12 || 12 : hour24);
}

export function isTimeAtOrBeforeThreshold(
  definition: TimeStatIdentity,
  value: number,
  threshold: number,
): boolean {
  return timeValueToScale(definition, value) <= timeValueToScale(definition, threshold);
}

export function averageTimeValues(definition: TimeStatIdentity, values: number[]): number | null {
  if (values.length === 0) return null;
  const average = values.reduce(
    (total, value) => total + timeValueToScale(definition, value),
    0,
  ) / values.length;
  return timeValueFromScale(definition, average);
}

export function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export function minutesToTimeValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';

  const rounded = Math.round(value);
  if (rounded < 0 || rounded >= MINUTES_PER_DAY) return '';

  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatTimeValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';

  const rounded = Math.round(value);
  if (rounded < 0 || rounded > MINUTES_PER_DAY) return '—';

  const minutes = rounded === MINUTES_PER_DAY ? 0 : rounded;
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

export function durationValueToMinutes(value: string): number | null {
  const match = /^(\d+):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const totalMinutes = hours * 60 + minutes;
  return Number.isSafeInteger(totalMinutes) ? totalMinutes : null;
}

export function minutesToDurationParts(value: number | null | undefined): { hours: string; minutes: string } {
  if (value == null || !Number.isFinite(value) || value < 0) return { hours: '', minutes: '' };

  const rounded = Math.round(value);
  return {
    hours: String(Math.floor(rounded / 60)),
    minutes: String(rounded % 60).padStart(2, '0'),
  };
}

export function minutesToDurationValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '';

  const rounded = Math.round(value);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function formatDurationValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';

  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
