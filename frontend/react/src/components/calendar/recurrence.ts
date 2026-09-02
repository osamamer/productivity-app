import { addDays, addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, startOfDay } from 'date-fns';
import { CalendarEvent, RecurrenceFrequency, RecurrenceUnit } from '../../types/CalendarEvent';

export type CalendarEventOccurrence = {
    id: string;
    occurrenceDate: string;
    start: string;
    end: string;
    allDay: boolean;
};

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
    const daysUntilRange = differenceInCalendarDays(startOfDay(rangeStart), startOfDay(anchor));
    const unit = recurrenceUnit(event.recurrenceFrequency, event.recurrenceUnit);
    const interval = recurrenceInterval(event);
    if (unit === 'DAYS') return Math.max(0, Math.floor((daysUntilRange - durationDays) / interval));
    if (unit === 'WEEKS') return Math.max(0, Math.floor((daysUntilRange - durationDays) / (interval * 7)));
    return Math.max(0, Math.floor((differenceInCalendarMonths(startOfDay(rangeStart), startOfDay(anchor)) - 1) / interval));
}

function dateString(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

function isAfterRecurrenceEnd(date: string, recurrenceEndDate: string | null): boolean {
    return recurrenceEndDate !== null && date > recurrenceEndDate;
}

function allDayOccurrences(
    event: CalendarEvent,
    rangeStart: Date,
    rangeEnd: Date,
): CalendarEventOccurrence[] {
    if (!event.startDate || !event.endDate) return [];

    const anchor = new Date(`${event.startDate}T12:00:00`);
    const durationDays = differenceInCalendarDays(
        new Date(`${event.endDate}T12:00:00`),
        anchor,
    ) + 1;
    const firstIndex = firstVisibleIndex(anchor, rangeStart, event, durationDays);
    const visibleRangeStart = startOfDay(rangeStart);
    const visibleRangeEnd = startOfDay(rangeEnd);
    const occurrences: CalendarEventOccurrence[] = [];

    for (let index = firstIndex; ; index += 1) {
        const start = occurrenceStart(anchor, event, index);
        const occurrenceDate = dateString(start);
        if (isAfterRecurrenceEnd(occurrenceDate, event.recurrenceEndDate)) break;
        if (start >= visibleRangeEnd) break;

        const end = addDays(start, durationDays);
        if (end > visibleRangeStart) {
            occurrences.push({
                id: index === 0 ? event.id : `${event.id}-${occurrenceDate}`,
                occurrenceDate,
                start: occurrenceDate,
                end: dateString(end),
                allDay: true,
            });
        }
    }
    return occurrences;
}

function timedOccurrences(
    event: CalendarEvent,
    rangeStart: Date,
    rangeEnd: Date,
): CalendarEventOccurrence[] {
    if (!event.startTime || !event.endTime) return [];

    const anchor = new Date(event.startTime);
    const end = new Date(event.endTime);
    const durationMilliseconds = end.getTime() - anchor.getTime();
    const firstIndex = firstVisibleIndex(anchor, rangeStart, event, 0);
    const occurrences: CalendarEventOccurrence[] = [];

    for (let index = firstIndex; ; index += 1) {
        const start = occurrenceStart(anchor, event, index);
        const occurrenceDate = dateString(start);
        if (isAfterRecurrenceEnd(occurrenceDate, event.recurrenceEndDate)) break;
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
                end: dateString(addDays(new Date(`${event.endDate}T12:00:00`), 1)),
                allDay: true,
            }];
        }
        if (!event.startTime || !event.endTime) return [];
        return [{
            id: event.id,
            occurrenceDate: dateString(new Date(event.startTime)),
            start: event.startTime,
            end: event.endTime,
            allDay: false,
        }];
    }

    return event.allDay
        ? allDayOccurrences(event, rangeStart, rangeEnd)
        : timedOccurrences(event, rangeStart, rangeEnd);
}
