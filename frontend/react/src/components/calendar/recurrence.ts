import { addDays, addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, startOfDay } from 'date-fns';
import { CalendarEvent, CalendarEventStatus, RecurrenceFrequency, RecurrenceUnit } from '../../types/CalendarEvent';

export type CalendarEventOccurrence = {
    id: string;
    occurrenceDate: string;
    occurrenceKey: string;
    start: string;
    end: string;
    allDay: boolean;
    status: CalendarEventStatus;
};

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
        const date = new Date(`${key.slice('date:'.length)}T12:00:00`);
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
    const expansionRange = rangeIncludingMovedOccurrences(event, rangeStart, rangeEnd);
    const firstIndex = firstVisibleIndex(anchor, expansionRange.start, event, durationDays);
    const visibleRangeStart = startOfDay(rangeStart);
    const visibleRangeEnd = startOfDay(rangeEnd);
    const occurrences: CalendarEventOccurrence[] = [];

    for (let index = firstIndex; ; index += 1) {
        const originalStart = occurrenceStart(anchor, event, index);
        const occurrenceDate = dateString(originalStart);
        if (isAfterRecurrenceEnd(occurrenceDate, event.recurrenceEndDate)) break;
        if (originalStart >= expansionRange.end) break;

        const key = occurrenceKey(originalStart, occurrenceDate, true);
        const override = occurrenceOverride(event, key);
        const start = override?.startDate
            ? new Date(`${override.startDate}T12:00:00`)
            : originalStart;
        const end = override?.endDate
            ? addDays(new Date(`${override.endDate}T12:00:00`), 1)
            : addDays(originalStart, durationDays);
        if (end > visibleRangeStart && start < visibleRangeEnd && !occurrenceIsDeleted(event, key)) {
            occurrences.push({
                id: index === 0 ? event.id : `${event.id}-${occurrenceDate}`,
                occurrenceDate: dateString(start),
                occurrenceKey: key,
                start: dateString(start),
                end: dateString(end),
                allDay: true,
                status: occurrenceStatus(event, key),
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
    const expansionRange = rangeIncludingMovedOccurrences(event, rangeStart, rangeEnd);
    const firstIndex = firstVisibleIndex(anchor, expansionRange.start, event, 0);
    const occurrences: CalendarEventOccurrence[] = [];

    for (let index = firstIndex; ; index += 1) {
        const originalStart = occurrenceStart(anchor, event, index);
        const occurrenceDate = dateString(originalStart);
        if (isAfterRecurrenceEnd(occurrenceDate, event.recurrenceEndDate)) break;
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
                occurrenceDate: dateString(start),
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
                occurrenceKey: occurrenceKey(new Date(`${event.startDate}T12:00:00`), event.startDate, true),
                start: event.startDate,
                end: dateString(addDays(new Date(`${event.endDate}T12:00:00`), 1)),
                allDay: true,
                status: event.status,
            }];
        }
        if (!event.startTime || !event.endTime) return [];
        return [{
            id: event.id,
            occurrenceDate: dateString(new Date(event.startTime)),
            occurrenceKey: occurrenceKey(new Date(event.startTime), dateString(new Date(event.startTime)), false),
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
