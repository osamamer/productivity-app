import { useEffect, useState } from 'react';
import { RevalidatingResource } from '../services/cache/revalidatingResource';
import { subscribeToAppRefresh } from '../services/utils/appRefresh';
import { keepUnchanged } from '../services/utils/keepUnchanged';

interface Options {
    // A kept value younger than this is shown without refetching. 0 always refetches on mount.
    freshMs: number;
    // Refetch on this interval while mounted, for data that keeps changing (today's screen time).
    refreshEveryMs?: number;
    // While a new key has nothing kept, keep showing the previous key's value instead of nothing.
    keepPrevious?: boolean;
}

interface State<T> {
    key: string | null;
    data: T | null;
    // True when `data` belongs to another key (only with `keepPrevious`).
    previous: boolean;
}

/**
 * Shows the kept value for `key` immediately and refreshes it in the background, so views
 * open with content instead of a spinner. It also refetches on the app-wide refresh
 * heartbeat; results are merged with `keepUnchanged`, so an unchanged answer re-renders
 * nothing and a changed one only touches what changed. `key` null means "nothing to load yet".
 * `loader` must load the data for the current `key`.
 */
export function useRevalidatingResource<T>(
    resource: RevalidatingResource<T>,
    key: string | null,
    loader: () => Promise<T>,
    { freshMs, refreshEveryMs, keepPrevious = false }: Options,
) {
    const [state, setState] = useState<State<T>>(() => ({ key, data: key ? resource.peek(key)?.value ?? null : null, previous: false }));
    const [error, setError] = useState<string | null>(null);

    // Switch to the new key during render, so the old key's data is never drawn under the new one.
    if (state.key !== key) {
        const kept = key ? resource.peek(key)?.value ?? null : null;
        const showPrevious = keepPrevious && kept === null && state.data !== null;
        setState({ key, data: showPrevious ? state.data : kept, previous: showPrevious });
    }

    useEffect(() => {
        if (!key) return undefined;
        let cancelled = false;
        const load = () => {
            resource.refresh(key, loader)
                .then(data => {
                    if (cancelled) return;
                    setState(current => {
                        if (current.key !== key) return current;
                        const merged = current.data !== null && !current.previous ? keepUnchanged(current.data, data) : data;
                        return merged === current.data && !current.previous ? current : { key, data: merged, previous: false };
                    });
                    setError(current => (current === null ? current : null));
                })
                .catch((loadError: unknown) => {
                    if (cancelled) return;
                    console.error(`Could not load ${key}:`, loadError);
                    setError(loadError instanceof Error ? loadError.message : String(loadError));
                })
        };
        if (!resource.isFresh(key, freshMs)) load();
        const timer = refreshEveryMs ? window.setInterval(load, refreshEveryMs) : undefined;
        const unsubscribe = subscribeToAppRefresh(() => {
            if (!resource.isFresh(key, freshMs)) load();
        });
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            unsubscribe();
        };
        // `loader` is expected to change with `key`; listing it would refetch on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resource, key, freshMs, refreshEveryMs]);

    const current = state.key === key ? state : { data: null, previous: false };
    return { data: current.data, previous: current.previous, error };
}
