import { addDays, addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, startOfDay } from 'date-fns';
import { CalendarEvent, RecurrenceFrequency } from '../../types/CalendarEvent';

export type CalendarEventOccurrence = {
    id: string;
    occurrenceDate: string;
    start: string;
    end: string;
    allDay: boolean;
};

function occurrenceStart(anchor: Date, frequency: RecurrenceFrequency, index: number): Date {
    if (frequency === 'DAILY') return addDays(anchor, index);
    if (frequency === 'WEEKLY') return addDays(anchor, index * 7);
    return addMonths(anchor, index);
}

function firstVisibleIndex(anchor: Date, rangeStart: Date, frequency: RecurrenceFrequency, durationDays: number): number {
    const daysUntilRange = differenceInCalendarDays(startOfDay(rangeStart), startOfDay(anchor));
    if (frequency === 'DAILY') return Math.max(0, daysUntilRange - durationDays);
    if (frequency === 'WEEKLY') return Math.max(0, Math.floor((daysUntilRange - durationDays) / 7));
    return Math.max(0, differenceInCalendarMonths(startOfDay(rangeStart), startOfDay(anchor)) - 1);
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
    frequency: RecurrenceFrequency,
): CalendarEventOccurrence[] {
    if (!event.startDate || !event.endDate) return [];

    const anchor = new Date(`${event.startDate}T12:00:00`);
    const durationDays = differenceInCalendarDays(
        new Date(`${event.endDate}T12:00:00`),
        anchor,
    ) + 1;
    const firstIndex = firstVisibleIndex(anchor, rangeStart, frequency, durationDays);
    const visibleRangeStart = startOfDay(rangeStart);
    const visibleRangeEnd = startOfDay(rangeEnd);
    const occurrences: CalendarEventOccurrence[] = [];

    for (let index = firstIndex; ; index += 1) {
        const start = occurrenceStart(anchor, frequency, index);
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
    frequency: RecurrenceFrequency,
): CalendarEventOccurrence[] {
    if (!event.startTime || !event.endTime) return [];

    const anchor = new Date(event.startTime);
    const end = new Date(event.endTime);
    const durationMilliseconds = end.getTime() - anchor.getTime();
    const firstIndex = firstVisibleIndex(anchor, rangeStart, frequency, 0);
    const occurrences: CalendarEventOccurrence[] = [];

    for (let index = firstIndex; ; index += 1) {
        const start = occurrenceStart(anchor, frequency, index);
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
        ? allDayOccurrences(event, rangeStart, rangeEnd, frequency)
        : timedOccurrences(event, rangeStart, rangeEnd, frequency);
}
