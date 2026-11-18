import { ActivityColor } from '../../types/Activity';

// Mid-tone hues that read on light and dark surfaces, in the order offered to the user.
// No red: an activity is not an alarm.
export const ACTIVITY_COLORS: Record<ActivityColor, string> = {
    violet: '#8b5cf6',
    blue: '#4f86e8',
    teal: '#2fa7a0',
    green: '#4fa86a',
    amber: '#d39b22',
    orange: '#e07b45',
    rose: '#d4668f',
    slate: '#7a8597',
};

export const ACTIVITY_COLOR_ORDER = Object.keys(ACTIVITY_COLORS) as ActivityColor[];

// Offered when someone has no activities yet; one click adds them.
export const SUGGESTED_ACTIVITIES: { name: string; color: ActivityColor }[] = [
    { name: 'Focus', color: 'violet' },
    { name: 'Leisure', color: 'teal' },
    { name: 'Admin', color: 'amber' },
    { name: 'Rest', color: 'blue' },
    { name: 'Exercise', color: 'green' },
];

export function activityHex(color: ActivityColor | undefined, fallback: string): string {
    return color ? ACTIVITY_COLORS[color] ?? fallback : fallback;
}
