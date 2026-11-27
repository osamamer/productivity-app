import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../../types/CalendarEvent';
import { expandCalendarEvent } from './recurrence';

function event(changes: Partial<CalendarEvent>): CalendarEvent {
    return {
        id: 'event-1',
        title: 'Swim',
        description: '',
        allDay: true,
        startDate: '2025-01-02',
        endDate: '2025-01-02',
        startTime: null,
        endTime: null,
        timeZone: 'UTC',
        status: 'CONFIRMED',
        recurrenceFrequency: 'CUSTOM',
        recurrenceEndDate: null,
        recurrenceInterval: 2,
        recurrenceUnit: 'WEEKS',
        recurrenceDaysOfWeek: ['SUNDAY', 'THURSDAY'],
        reminderMinutesBefore: null,
        ...changes,
    } as CalendarEvent;
}

describe('events that repeat on chosen weekdays', () => {
    it('repeat every second week, with weeks starting on Sunday', () => {
        const occurrences = expandCalendarEvent(event({}), new Date('2025-01-01T00:00:00'), new Date('2025-01-27T00:00:00'));

        expect(occurrences.map(occurrence => occurrence.occurrenceDate))
            .toEqual(['2025-01-02', '2025-01-12', '2025-01-16', '2025-01-26']);
        expect(occurrences[0].id).toBe('event-1');
        expect(occurrences[1].id).toBe('event-1-2025-01-12');
    });

    it('keep the time of day for timed events and stop at the end date', () => {
        const occurrences = expandCalendarEvent(event({
            allDay: false,
            startDate: null,
            endDate: null,
            startTime: new Date('2025-01-02T09:00:00').toISOString(),
            endTime: new Date('2025-01-02T10:00:00').toISOString(),
            recurrenceInterval: 1,
            recurrenceDaysOfWeek: ['MONDAY'],
            recurrenceEndDate: '2025-01-13',
        }), new Date('2025-01-01T00:00:00'), new Date('2025-02-01T00:00:00'));

        expect(occurrences.map(occurrence => new Date(occurrence.start).getHours())).toEqual([9, 9]);
        expect(occurrences.map(occurrence => occurrence.occurrenceDate)).toEqual(['2025-01-06', '2025-01-13']);
    });
});
