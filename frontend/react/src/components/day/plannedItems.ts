import { parseISO } from 'date-fns';
import { expandCalendarEvent } from '../calendar/recurrence';
import { DayOverview } from '../../types/DayOverview';
import { Activity } from '../../types/Activity';
import { activityHex } from '../activity/activityColors';
import { PlannedInput } from './dayTimelineLayout';

/**
 * What the day was meant to hold: timed calendar events (coloured by activity when they are
 * chunks), and focus sessions, which are a
 * stated intention to work on one task. All-day and cancelled events have no place on a
 * time axis.
 */
export function plannedItems(overview: DayOverview, windowStart: Date, windowEnd: Date, now: number, activities: Activity[] = []): PlannedInput[] {
    const activitiesById = new Map(activities.map(activity => [activity.id, activity]));
    const events = overview.events.flatMap(event => {
        const activity = event.activityId ? activitiesById.get(event.activityId) : undefined;
        return expandCalendarEvent(event, windowStart, windowEnd)
            .filter(occurrence => !occurrence.allDay && occurrence.status !== 'CANCELLED')
            .map((occurrence): PlannedInput => ({
                id: `event-${occurrence.id}`,
                kind: 'event',
                title: event.title,
                start: parseISO(occurrence.start).getTime(),
                end: parseISO(occurrence.end).getTime(),
                ...(activity ? { activityName: activity.name, color: activityHex(activity.color, '') } : {}),
            }));
    });
    const focus = overview.focusSessions.map((session): PlannedInput => ({
        id: `focus-${session.id}`,
        kind: 'focus',
        title: session.taskName || 'Focus session',
        start: parseISO(session.startTime).getTime(),
        end: session.endTime ? parseISO(session.endTime).getTime() : now,
    }));
    return [...events, ...focus].filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);
}
