import { useEffect, useState, useSyncExternalStore } from 'react';
import { activityTimerStore } from '../services/cache/activityTimerStore';
import { useAppRefresh } from './useAppRefresh';

const refresh = () => {
    activityTimerStore.refresh().catch(error => console.error('Could not load the activity timer:', error));
};

/** The running activity timer, kept current on the app refresh heartbeat. */
export function useActivityTimer() {
    const state = useSyncExternalStore(activityTimerStore.subscribe, activityTimerStore.snapshot);
    useEffect(refresh, []);
    useAppRefresh(refresh);
    return { current: state.current, loaded: state.loaded };
}

/** Now, updated every `everyMs` while `ticking`, for live clocks. */
export function useNow(ticking: boolean, everyMs = 1000): number {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        if (!ticking) return undefined;
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), everyMs);
        return () => window.clearInterval(timer);
    }, [ticking, everyMs]);
    return now;
}
