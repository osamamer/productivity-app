import { parseISO } from 'date-fns';
import { Activity } from '../../types/Activity';
import { ActivitySession } from '../../types/ActivitySession';
import { DayFocusSession } from '../../types/DayOverview';
import { activityHex } from '../activity/activityColors';
import { PlannedInput } from './dayTimelineLayout';

/**
 * What was actually done, for the "Did" lane: timed activities and focus sessions. A running
 * timer reaches to now; a paused one stops where it was paused. Pauses inside a session are
 * not shown (the server keeps only their total).
 */
export function didItems(
    sessions: ActivitySession[],
    activities: Activity[],
    now: number,
    focusSessions: DayFocusSession[] = [],
): PlannedInput[] {
    const byId = new Map(activities.map(activity => [activity.id, activity]));
    const timers = sessions.map((session): PlannedInput => {
        const activity = session.activityId ? byId.get(session.activityId) : undefined;
        const end = session.endedAt ?? session.pausedAt;
        return {
            id: `timer-${session.id}`,
            kind: 'timer',
            title: session.title,
            start: Date.parse(session.startedAt),
            end: end ? Date.parse(end) : now,
            ...(activity ? { activityName: activity.name, color: activityHex(activity.color, '') } : {}),
        };
    });
    const focus = focusSessions.map((session): PlannedInput => ({
        id: `focus-${session.id}`,
        kind: 'focus',
        title: session.taskName || 'Focus session',
        start: parseISO(session.startTime).getTime(),
        end: session.endTime ? parseISO(session.endTime).getTime() : now,
    }));
    return [...timers, ...focus].filter(item => Number.isFinite(item.start) && item.end > item.start);
}
