import { activitySessionService } from '../api/activitySessionService';
import { ActivitySession, StartActivitySessionInput } from '../../types/ActivitySession';
import { getAuthCacheScope } from '../utils/authHeaders';
import { keepUnchanged } from '../utils/keepUnchanged';
import { dayOverviewResource } from './dayOverviewCache';

// The one running activity timer, shared by Home's Leisure view, the side nav and the countdown alert.

interface State {
    scope: string;
    loaded: boolean;
    current: ActivitySession | null;
}

let state: State = { scope: '', loaded: false, current: null };
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(current: ActivitySession | null): void {
    const kept = current && state.current ? keepUnchanged(state.current, current) : current;
    if (state.loaded && kept === state.current && state.scope === getAuthCacheScope()) return;
    state = { scope: getAuthCacheScope(), loaded: true, current: kept };
    listeners.forEach(listener => listener());
}

/** Any change to timers changes the day's "Did" lane, so day views refetch. */
function changed(current: ActivitySession | null): ActivitySession | null {
    publish(current?.active ? current : null);
    dayOverviewResource.expireAll();
    return current;
}

const EMPTY: State = { scope: '', loaded: false, current: null };

export const activityTimerStore = {
    subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    snapshot(): State {
        return state.scope === getAuthCacheScope() ? state : EMPTY;
    },

    refresh(): Promise<void> {
        if (request) return request;
        const scope = getAuthCacheScope();
        request = activitySessionService.getCurrent()
            .then(current => {
                if (scope === getAuthCacheScope()) publish(current);
            })
            .finally(() => { request = null; });
        return request;
    },

    async start(input: StartActivitySessionInput): Promise<ActivitySession> {
        return changed(await activitySessionService.start(input)) as ActivitySession;
    },

    async pause(session: ActivitySession): Promise<void> {
        publish({ ...session, paused: true, pausedAt: new Date().toISOString() });
        try {
            changed(await activitySessionService.pause(session.id));
        } catch (error) {
            publish(session);
            throw error;
        }
    },

    async resume(session: ActivitySession): Promise<void> {
        changed(await activitySessionService.resume(session.id));
    },

    async end(session: ActivitySession): Promise<void> {
        publish(null);
        try {
            changed(await activitySessionService.end(session.id));
        } catch (error) {
            publish(session);
            throw error;
        }
    },
};
