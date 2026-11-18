import { activityService } from '../api/activityService';
import { Activity, ActivityInput } from '../../types/Activity';
import { getAuthCacheScope } from '../utils/authHeaders';
import { keepUnchanged } from '../utils/keepUnchanged';

// One shared list, so an activity added in Settings shows up in the event form and the day
// view at once. Kept per account; changes are applied optimistically and rolled back on failure.

interface State {
    scope: string;
    activities: Activity[] | null;
}

let state: State = { scope: '', activities: null };
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function sorted(activities: Activity[]): Activity[] {
    return [...activities].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

function publish(activities: Activity[] | null): void {
    const next = activities && state.activities ? keepUnchanged(state.activities, activities) : activities;
    if (next === state.activities) return;
    state = { scope: getAuthCacheScope(), activities: next };
    listeners.forEach(listener => listener());
}

export const activityStore = {
    subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    /** The current account's activities, or null before the first load. */
    snapshot(): Activity[] | null {
        return state.scope === getAuthCacheScope() ? state.activities : null;
    },

    refresh(): Promise<void> {
        if (request) return request;
        const scope = getAuthCacheScope();
        request = activityService.getActivities()
            .then(activities => {
                if (scope === getAuthCacheScope()) publish(sorted(activities));
            })
            .finally(() => { request = null; });
        return request;
    },

    async create(input: ActivityInput): Promise<Activity> {
        const created = await activityService.createActivity(input);
        publish(sorted([...(this.snapshot() ?? []), created]));
        return created;
    },

    async update(activityId: string, input: ActivityInput): Promise<void> {
        const before = this.snapshot() ?? [];
        publish(sorted(before.map(activity => activity.id === activityId ? { ...activity, ...input } : activity)));
        try {
            const saved = await activityService.updateActivity(activityId, input);
            publish(sorted((this.snapshot() ?? []).map(activity => activity.id === activityId ? saved : activity)));
        } catch (error) {
            publish(before);
            throw error;
        }
    },

    async remove(activityId: string): Promise<void> {
        const before = this.snapshot() ?? [];
        publish(before.filter(activity => activity.id !== activityId));
        try {
            await activityService.deleteActivity(activityId);
        } catch (error) {
            publish(before);
            throw error;
        }
    },
};
