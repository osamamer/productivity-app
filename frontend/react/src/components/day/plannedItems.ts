import { parseISO } from 'date-fns';
import { expandCalendarEvent } from '../calendar/recurrence';
import { DayOverview } from '../../types/DayOverview';
import { PlannedInput } from './dayTimelineLayout';

/**
 * What the day was meant to hold: timed calendar events, and focus sessions, which are a
 * stated intention to work on one task. All-day and cancelled events have no place on a
 * time axis.
 */
export function plannedItems(overview: DayOverview, windowStart: Date, windowEnd: Date, now: number): PlannedInput[] {
    const events = overview.events.flatMap(event =>
        expandCalendarEvent(event, windowStart, windowEnd)
            .filter(occurrence => !occurrence.allDay && occurrence.status !== 'CANCELLED')
            .map(occurrence => ({
                id: `event-${occurrence.id}`,
                kind: 'event' as const,
                title: event.title,
                start: parseISO(occurrence.start).getTime(),
                end: parseISO(occurrence.end).getTime(),
            })));
    const focus = overview.focusSessions.map(session => ({
        id: `focus-${session.id}`,
        kind: 'focus' as const,
        title: session.taskName || 'Focus session',
        start: parseISO(session.startTime).getTime(),
        end: session.endTime ? parseISO(session.endTime).getTime() : now,
    }));
    return [...events, ...focus].filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);
}
