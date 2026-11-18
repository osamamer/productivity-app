import { dayService } from '../api/dayService';
import { DayOverview } from '../../types/DayOverview';
import { getAuthCacheScope } from '../utils/authHeaders';
import { RevalidatingResource } from './revalidatingResource';
import { subscribeToResourceInvalidation } from './resourceInvalidation';

// A day overview gathers tasks, stats, events, notes and sessions, which change from many
// places, so views always refetch on open and only show the kept copy meanwhile.
const KEEP_MS = 24 * 60 * 60 * 1000;
// Neighbouring days fetched ahead of time count as fresh for a minute.
export const PREFETCH_FRESH_MS = 60_000;

export const dayOverviewResource = new RevalidatingResource<DayOverview>({ keepMs: KEEP_MS, maxEntries: 40 });

export function dayOverviewKey(date: string): string {
    return `${getAuthCacheScope()}:day-overview:${date}`;
}

export function loadDayOverview(date: string): Promise<DayOverview> {
    return dayService.getOverview(date);
}

export function prefetchDayOverview(date: string): void {
    dayOverviewResource.ensure(dayOverviewKey(date), () => loadDayOverview(date), PREFETCH_FRESH_MS)
        .catch(error => console.warn(`Could not prefetch the overview of ${date}:`, error));
}

subscribeToResourceInvalidation('tasks', () => dayOverviewResource.expireAll());
subscribeToResourceInvalidation('stats', () => dayOverviewResource.expireAll());
