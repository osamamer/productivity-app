import { useEffect, useSyncExternalStore } from 'react';
import { activityStore } from '../services/cache/activityStore';
import { useAppRefresh } from './useAppRefresh';

const refresh = () => {
    activityStore.refresh().catch(error => console.error('Could not load activities:', error));
};

/** The user's activities (null until first loaded), kept current on the app refresh heartbeat. */
export function useActivities() {
    const activities = useSyncExternalStore(activityStore.subscribe, activityStore.snapshot);
    useEffect(refresh, []);
    useAppRefresh(refresh);
    return activities;
}
