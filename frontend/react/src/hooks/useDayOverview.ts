import { useEffect } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { dayOverviewKey, dayOverviewResource, loadDayOverview, prefetchDayOverview } from '../services/cache/dayOverviewCache';
import { useRevalidatingResource } from './useRevalidatingResource';

function neighbour(date: string, days: number): string {
    return format(addDays(parseISO(`${date}T12:00:00`), days), 'yyyy-MM-dd');
}

/**
 * One day's overview: the kept copy at once, refreshed on every open, with the days either side
 * fetched ahead so stepping between days does not wait.
 */
export function useDayOverview(date: string | null) {
    const { data, error } = useRevalidatingResource(
        dayOverviewResource,
        date ? dayOverviewKey(date) : null,
        () => loadDayOverview(date as string),
        { freshMs: 0 },
    );
    const loaded = data !== null;

    useEffect(() => {
        if (!date || !loaded) return;
        prefetchDayOverview(neighbour(date, -1));
        prefetchDayOverview(neighbour(date, 1));
    }, [date, loaded]);

    return { overview: data, error: error ? 'Could not load this day.' : null };
}
