import { Activity } from '../../types/Activity';
import { ActivitySession } from '../../types/ActivitySession';
import { activityHex } from '../activity/activityColors';
import { PlannedInput } from './dayTimelineLayout';

/**
 * What was actually timed, for the "Did" lane. A running timer reaches to now; a paused one
 * stops where it was paused. Pauses inside a session are not shown (the server keeps only
 * their total).
 */
export function didItems(sessions: ActivitySession[], activities: Activity[], now: number): PlannedInput[] {
    const byId = new Map(activities.map(activity => [activity.id, activity]));
    return sessions.map((session): PlannedInput => {
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
    }).filter(item => Number.isFinite(item.start) && item.end > item.start);
}
