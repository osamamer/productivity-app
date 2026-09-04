import type { CalendarEvent, RecurrenceFrequency, RecurrenceUnit } from '@/types/models';

export interface CalendarEventOccurrence {
  id: string;
  occurrenceDate: string;
  start: string;
  end: string;
  allDay: boolean;
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
  const firstIndex = firstVisibleIndex(anchor, rangeStart, event, durationDays);
  const occurrences: CalendarEventOccurrence[] = [];

  for (let index = firstIndex; ; index += 1) {
    const start = occurrenceStart(anchor, event, index);
    const occurrenceDate = dateKey(start);
    if (recurrenceEnded(occurrenceDate, event.recurrenceEndDate)) break;
    if (start >= rangeEnd) break;

    const end = addDays(start, durationDays);
    if (end > rangeStart) {
      occurrences.push({
        id: index === 0 ? event.id : `${event.id}-${occurrenceDate}`,
        occurrenceDate,
        start: occurrenceDate,
        end: dateKey(end),
        allDay: true,
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
  const firstIndex = firstVisibleIndex(anchor, rangeStart, event, 0);
  const occurrences: CalendarEventOccurrence[] = [];

  for (let index = firstIndex; ; index += 1) {
    const start = occurrenceStart(anchor, event, index);
    const occurrenceDate = dateKey(start);
    if (recurrenceEnded(occurrenceDate, event.recurrenceEndDate)) break;
    if (start >= rangeEnd) break;

    const occurrenceEnd = new Date(start.getTime() + durationMilliseconds);
    if (occurrenceEnd > rangeStart) {
      occurrences.push({
        id: index === 0 ? event.id : `${event.id}-${occurrenceDate}`,
        occurrenceDate,
        start: start.toISOString(),
        end: occurrenceEnd.toISOString(),
        allDay: false,
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
        start: event.startDate,
        end: dateKey(addDays(dateFromKey(event.endDate), 1)),
        allDay: true,
      }];
    }
    if (!event.startTime || !event.endTime) return [];
    return [{
      id: event.id,
      occurrenceDate: dateKey(new Date(event.startTime)),
      start: event.startTime,
      end: event.endTime,
      allDay: false,
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
