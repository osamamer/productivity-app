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

export function formatDurationValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';

  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
