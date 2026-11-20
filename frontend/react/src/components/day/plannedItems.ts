import { parseISO } from 'date-fns';
import { expandCalendarEvent } from '../calendar/recurrence';
import { DayOverview } from '../../types/DayOverview';
import { Activity } from '../../types/Activity';
import { activityHex } from '../activity/activityColors';
import { PlannedInput } from './dayTimelineLayout';

/**
 * What the day was meant to hold: timed calendar events, coloured by activity when they are
 * chunks, and focus blocks planned for a task. Focus sessions are what actually happened, so they sit in the "Did" lane instead
 * (see didItems), which lets a planned chunk be compared with the time it really took. All-day
 * and cancelled events have no place on a time axis.
 */
export function plannedItems(overview: DayOverview, windowStart: Date, windowEnd: Date, activities: Activity[] = []): PlannedInput[] {
    const activitiesById = new Map(activities.map(activity => [activity.id, activity]));
    const events = overview.events.flatMap(event => {
        const activity = event.activityId ? activitiesById.get(event.activityId) : undefined;
        return expandCalendarEvent(event, windowStart, windowEnd)
            .filter(occurrence => !occurrence.allDay && occurrence.status !== 'CANCELLED')
            .map((occurrence): PlannedInput => ({
                id: `event-${occurrence.id}`,
                // A block planned for a task is focus time; its title is the task.
                kind: event.taskId ? 'focus' : 'event',
                title: event.title,
                start: parseISO(occurrence.start).getTime(),
                end: parseISO(occurrence.end).getTime(),
                ...(activity ? { activityName: activity.name, color: activityHex(activity.color, '') } : {}),
            }));
    });
    return events.filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);
}
