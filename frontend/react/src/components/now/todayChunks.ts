import { parseISO } from 'date-fns';
import { expandCalendarEvent } from '../calendar/recurrence.ts';
import type { DayOverview } from '../../types/DayOverview.ts';
import type { PlannedChunk } from './nowPlan.ts';

/** Today's timed, not-cancelled calendar events in the overview's window, as chunks. */
export function todayChunks(overview: DayOverview): PlannedChunk[] {
    const start = parseISO(overview.dayStart);
    const end = parseISO(overview.dayEnd);
    return overview.events.flatMap(event => expandCalendarEvent(event, start, end)
        .filter(occurrence => !occurrence.allDay && occurrence.status !== 'CANCELLED')
        .map(occurrence => ({
            id: occurrence.id,
            eventId: event.id,
            title: event.title,
            activityId: event.activityId ?? null,
            start: parseISO(occurrence.start).getTime(),
            end: parseISO(occurrence.end).getTime(),
        })))
        // The overview carries every event, and expandCalendarEvent returns one-off events whatever the range.
        .filter(chunk => chunk.end > start.getTime() && chunk.start < end.getTime());
}
