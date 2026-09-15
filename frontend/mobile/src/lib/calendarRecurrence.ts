import type { CalendarEvent, CalendarEventStatus, RecurrenceFrequency, RecurrenceUnit } from '@/types/models';

export interface CalendarEventOccurrence {
  id: string;
  occurrenceDate: string;
  occurrenceKey: string;
  start: string;
  end: string;
  allDay: boolean;
  status: CalendarEventStatus;
}

function occurrenceKey(start: Date, occurrenceDate: string, allDay: boolean): string {
  return allDay ? `date:${occurrenceDate}` : `instant:${start.toISOString()}`;
}

function sameOccurrenceKey(first: string, second: string): boolean {
  if (first === second) return true;
  if (!first.startsWith('instant:') || !second.startsWith('instant:')) return false;
  const firstInstant = Date.parse(first.slice('instant:'.length));
  const secondInstant = Date.parse(second.slice('instant:'.length));
  return !Number.isNaN(firstInstant) && firstInstant === secondInstant;
}

function occurrenceOverride(event: CalendarEvent, key: string) {
  return (event.occurrenceOverrides ?? []).find(override => sameOccurrenceKey(override.occurrenceKey, key));
}

function occurrenceIsDeleted(event: CalendarEvent, key: string): boolean {
  return occurrenceOverride(event, key)?.deleted === true;
}

function occurrenceStatus(event: CalendarEvent, key: string): CalendarEventStatus {
  if (event.status === 'CANCELLED') return 'CANCELLED';
  return occurrenceOverride(event, key)?.status
    ?? ((event.cancelledOccurrenceKeys ?? []).some(cancelledKey => sameOccurrenceKey(cancelledKey, key))
      ? 'CANCELLED'
      : event.status);
}

function occurrenceKeyDate(key: string, allDay: boolean): Date | null {
  if (allDay && key.startsWith('date:')) {
    const date = dateFromKey(key.slice('date:'.length));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (!allDay && key.startsWith('instant:')) {
    const date = new Date(key.slice('instant:'.length));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function rangeIncludingMovedOccurrences(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
): { start: Date; end: Date } {
  let start = rangeStart;
  let end = rangeEnd;

  (event.occurrenceOverrides ?? []).forEach(override => {
    const hasMove = event.allDay
      ? Boolean(override.startDate && override.endDate)
      : Boolean(override.startTime && override.endTime);
    if (!hasMove) return;

    const originalOccurrence = occurrenceKeyDate(override.occurrenceKey, event.allDay);
    if (!originalOccurrence) return;
    if (originalOccurrence < start) start = originalOccurrence;
    if (originalOccurrence >= end) end = addDays(originalOccurrence, 1);
  });

  return { start, end };
}

function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number): Date {
  const targetMonth = date.getMonth() + amount;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const next = new Date(date);
  next.setFullYear(targetYear, normalizedMonth, Math.min(date.getDate(), lastDay));
  return next;
}

function calendarDayDifference(first: Date, second: Date): number {
  const firstUtc = Date.UTC(first.getFullYear(), first.getMonth(), first.getDate());
  const secondUtc = Date.UTC(second.getFullYear(), second.getMonth(), second.getDate());
  return Math.round((firstUtc - secondUtc) / 86_400_000);
}

function calendarMonthDifference(first: Date, second: Date): number {
  return (first.getFullYear() - second.getFullYear()) * 12 + first.getMonth() - second.getMonth();
}

function recurrenceInterval(event: CalendarEvent): number {
  return event.recurrenceFrequency === 'CUSTOM' ? event.recurrenceInterval ?? 1 : 1;
}

function recurrenceUnit(frequency: RecurrenceFrequency, customUnit: RecurrenceUnit | null): RecurrenceUnit {
  if (frequency === 'DAILY') return 'DAYS';
  if (frequency === 'WEEKLY') return 'WEEKS';
  if (frequency === 'MONTHLY') return 'MONTHS';
  return customUnit ?? 'WEEKS';
}

function occurrenceStart(anchor: Date, event: CalendarEvent, index: number): Date {
  const unit = recurrenceUnit(event.recurrenceFrequency, event.recurrenceUnit);
  const amount = index * recurrenceInterval(event);
  if (unit === 'DAYS') return addDays(anchor, amount);
  if (unit === 'WEEKS') return addDays(anchor, amount * 7);
  return addMonths(anchor, amount);
}

function firstVisibleIndex(anchor: Date, rangeStart: Date, event: CalendarEvent, durationDays: number): number {
  const daysUntilRange = calendarDayDifference(rangeStart, anchor);
  const unit = recurrenceUnit(event.recurrenceFrequency, event.recurrenceUnit);
  const interval = recurrenceInterval(event);
  if (unit === 'DAYS') return Math.max(0, Math.floor((daysUntilRange - durationDays) / interval));
  if (unit === 'WEEKS') return Math.max(0, Math.floor((daysUntilRange - durationDays) / (interval * 7)));
  return Math.max(0, Math.floor((calendarMonthDifference(rangeStart, anchor) - 1) / interval));
}

function recurrenceEnded(date: string, recurrenceEndDate: string | null): boolean {
  return recurrenceEndDate !== null && date > recurrenceEndDate;
}

function allDayOccurrences(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): CalendarEventOccurrence[] {
  if (!event.startDate || !event.endDate) return [];

  const anchor = dateFromKey(event.startDate);
  const durationDays = calendarDayDifference(dateFromKey(event.endDate), anchor) + 1;
  const expansionRange = rangeIncludingMovedOccurrences(event, rangeStart, rangeEnd);
  const firstIndex = firstVisibleIndex(anchor, expansionRange.start, event, durationDays);
  const occurrences: CalendarEventOccurrence[] = [];

  for (let index = firstIndex; ; index += 1) {
    const originalStart = occurrenceStart(anchor, event, index);
    const occurrenceDate = dateKey(originalStart);
    if (recurrenceEnded(occurrenceDate, event.recurrenceEndDate)) break;
    if (originalStart >= expansionRange.end) break;

    const key = occurrenceKey(originalStart, occurrenceDate, true);
    const override = occurrenceOverride(event, key);
    const start = override?.startDate ? dateFromKey(override.startDate) : originalStart;
    const end = override?.endDate
      ? addDays(dateFromKey(override.endDate), 1)
      : addDays(originalStart, durationDays);
    if (end > rangeStart && start < rangeEnd && !occurrenceIsDeleted(event, key)) {
      occurrences.push({
        id: index === 0 ? event.id : `${event.id}-${occurrenceDate}`,
        occurrenceDate: dateKey(start),
        occurrenceKey: key,
        start: dateKey(start),
        end: dateKey(end),
        allDay: true,
        status: occurrenceStatus(event, key),
      });
    }
  }
  return occurrences;
}

function timedOccurrences(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): CalendarEventOccurrence[] {
  if (!event.startTime || !event.endTime) return [];

  const anchor = new Date(event.startTime);
  const end = new Date(event.endTime);
  const durationMilliseconds = end.getTime() - anchor.getTime();
  const expansionRange = rangeIncludingMovedOccurrences(event, rangeStart, rangeEnd);
  const firstIndex = firstVisibleIndex(anchor, expansionRange.start, event, 0);
  const occurrences: CalendarEventOccurrence[] = [];

  for (let index = firstIndex; ; index += 1) {
    const originalStart = occurrenceStart(anchor, event, index);
    const occurrenceDate = dateKey(originalStart);
    if (recurrenceEnded(occurrenceDate, event.recurrenceEndDate)) break;
    if (originalStart >= expansionRange.end) break;

    const originalEnd = new Date(originalStart.getTime() + durationMilliseconds);
    const key = occurrenceKey(originalStart, occurrenceDate, false);
    const override = occurrenceOverride(event, key);
    const movedStart = override?.startTime ? new Date(override.startTime) : null;
    const movedEnd = override?.endTime ? new Date(override.endTime) : null;
    const hasValidMove = movedStart && movedEnd
      && !Number.isNaN(movedStart.getTime())
      && !Number.isNaN(movedEnd.getTime())
      && movedEnd > movedStart;
    const start = hasValidMove ? movedStart : originalStart;
    const occurrenceEnd = hasValidMove ? movedEnd : originalEnd;
    if (occurrenceEnd > rangeStart && start < rangeEnd && !occurrenceIsDeleted(event, key)) {
      occurrences.push({
        id: index === 0 ? event.id : `${event.id}-${occurrenceDate}`,
        occurrenceDate: dateKey(start),
        occurrenceKey: key,
        start: start.toISOString(),
        end: occurrenceEnd.toISOString(),
        allDay: false,
        status: occurrenceStatus(event, key),
      });
    }
  }
  return occurrences;
}

export function expandCalendarEvent(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): CalendarEventOccurrence[] {
  const frequency = event.recurrenceFrequency ?? 'NONE';
  if (frequency === 'NONE') {
    if (event.allDay && event.startDate && event.endDate) {
      return [{
        id: event.id,
        occurrenceDate: event.startDate,
        occurrenceKey: occurrenceKey(dateFromKey(event.startDate), event.startDate, true),
        start: event.startDate,
        end: dateKey(addDays(dateFromKey(event.endDate), 1)),
        allDay: true,
        status: event.status,
      }];
    }
    if (!event.startTime || !event.endTime) return [];
    return [{
      id: event.id,
      occurrenceDate: dateKey(new Date(event.startTime)),
      occurrenceKey: occurrenceKey(new Date(event.startTime), dateKey(new Date(event.startTime)), false),
      start: event.startTime,
      end: event.endTime,
      allDay: false,
      status: event.status,
    }];
  }

  return event.allDay
    ? allDayOccurrences(event, rangeStart, rangeEnd)
    : timedOccurrences(event, rangeStart, rangeEnd);
}

export function datesCoveredByOccurrence(occurrence: CalendarEventOccurrence): string[] {
  if (!occurrence.allDay) return [occurrence.occurrenceDate];
  const start = dateFromKey(occurrence.start);
  const end = dateFromKey(occurrence.end);
  const dates: string[] = [];
  for (let date = start; date < end; date = addDays(date, 1)) dates.push(dateKey(date));
  return dates;
}
