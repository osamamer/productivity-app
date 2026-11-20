import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActivityTimer } from '../../hooks/useActivityTimer';

export type HomeMode = 'labor' | 'leisure';

/**
 * Home shows labor (tasks) unless the URL says otherwise. Without a `mode` in the URL, a running
 * activity timer opens leisure, where it lives; the choice is then written to the URL so that
 * stopping the timer does not switch the page under the person.
 */
export function useHomeMode(): [HomeMode, (mode: HomeMode) => void] {
    const [params, setParams] = useSearchParams();
    const { current, loaded } = useActivityTimer();
    const explicit = params.get('mode');
    const mode: HomeMode = explicit ? (explicit === 'leisure' ? 'leisure' : 'labor') : current ? 'leisure' : 'labor';

    const writeMode = useCallback((next: HomeMode) => {
        setParams(previous => {
            const updated = new URLSearchParams(previous);
            updated.set('mode', next);
            return updated;
        }, { replace: true });
    }, [setParams]);

    const pinned = useRef(false);
    useEffect(() => {
        if (pinned.current || !loaded) return;
        pinned.current = true;
        if (!explicit && current) writeMode('leisure');
    }, [current, explicit, loaded, writeMode]);

    return [mode, writeMode];
}
