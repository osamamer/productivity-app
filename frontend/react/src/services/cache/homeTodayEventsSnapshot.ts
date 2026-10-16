import { CalendarEvent } from '../../types/CalendarEvent';
import { getAuthCacheScope } from '../utils/authHeaders';

const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Snapshot = {
    savedAt: number;
    events: CalendarEvent[];
};

function snapshotStorageKey(dateKey: string): string {
    return `claritard:${getAuthCacheScope()}:home-events:${dateKey}`;
}

export const homeTodayEventsSnapshot = {
    get(dateKey: string): CalendarEvent[] | undefined {
        if (typeof window === 'undefined') return undefined;

        const key = snapshotStorageKey(dateKey);
        try {
            const raw = window.sessionStorage.getItem(key);
            if (!raw) return undefined;

            const snapshot = JSON.parse(raw) as Partial<Snapshot>;
            if (!Array.isArray(snapshot.events)
                || typeof snapshot.savedAt !== 'number'
                || Date.now() - snapshot.savedAt > SNAPSHOT_MAX_AGE_MS) {
                window.sessionStorage.removeItem(key);
                return undefined;
            }
            return snapshot.events;
        } catch (error) {
            console.warn('Could not read cached Home events:', error);
            return undefined;
        }
    },

    set(dateKey: string, events: CalendarEvent[]): void {
        if (typeof window === 'undefined') return;

        try {
            window.sessionStorage.setItem(snapshotStorageKey(dateKey), JSON.stringify({
                savedAt: Date.now(),
                events,
            } satisfies Snapshot));
        } catch (error) {
            console.warn('Could not cache Home events:', error);
        }
    },
};
