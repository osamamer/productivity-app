import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type HomeMode = 'labor' | 'leisure';

/** Home shows labor (tasks) unless the URL says `?mode=leisure`, so a fresh visit always opens on labor. */
export function useHomeMode(): [HomeMode, (mode: HomeMode) => void] {
    const [params, setParams] = useSearchParams();
    const mode: HomeMode = params.get('mode') === 'leisure' ? 'leisure' : 'labor';
    const setMode = useCallback((next: HomeMode) => {
        setParams(previous => {
            const updated = new URLSearchParams(previous);
            if (next === 'leisure') updated.set('mode', 'leisure');
            else updated.delete('mode');
            return updated;
        }, { replace: true });
    }, [setParams]);
    return [mode, setMode];
}
