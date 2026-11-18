import { useEffect, useRef } from 'react';
import { subscribeToAppRefresh } from '../services/utils/appRefresh';

/** Runs `refresh` on the app-wide refresh heartbeat while the component is mounted. */
export function useAppRefresh(refresh: () => void, enabled = true): void {
    const latest = useRef(refresh);
    latest.current = refresh;

    useEffect(() => {
        if (!enabled) return undefined;
        return subscribeToAppRefresh(() => latest.current());
    }, [enabled]);
}
