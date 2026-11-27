import { format } from 'date-fns';
import { useState } from 'react';
import { loadPathsOverview, pathsOverviewKey, pathsOverviewResource } from '../services/cache/pathsOverviewCache';
import { useAppRefresh } from './useAppRefresh';
import { useRevalidatingResource } from './useRevalidatingResource';

function localToday(): string {
    return format(new Date(), 'yyyy-MM-dd');
}

/** The Paths page data: the kept copy at once, refreshed on open and on the app heartbeat. */
export function usePathsOverview() {
    const [today, setToday] = useState(localToday);
    useAppRefresh(() => setToday(current => {
        const now = localToday();
        return now === current ? current : now;
    }));
    const { data, error, mutate } = useRevalidatingResource(
        pathsOverviewResource,
        pathsOverviewKey(today),
        () => loadPathsOverview(today),
        { freshMs: 0 },
    );
    return { overview: data, today, error: error ? 'Could not load your paths.' : null, mutate };
}
