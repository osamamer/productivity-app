import { pathService } from '../api/pathService';
import type { PathsOverview } from '../../types/Path';
import { getAuthCacheScope } from '../utils/authHeaders';
import { RevalidatingResource } from './revalidatingResource';
import { subscribeToResourceInvalidation } from './resourceInvalidation';

const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
// Strengths come from stat entries logged anywhere in the app, so a view always refetches on open.
export const pathsOverviewResource = new RevalidatingResource<PathsOverview>({ keepMs: KEEP_MS, maxEntries: 4 });

export function pathsOverviewKey(today: string): string {
    return `${getAuthCacheScope()}:paths-overview:${today}`;
}

export function loadPathsOverview(today: string): Promise<PathsOverview> {
    return pathService.getOverview(today);
}

subscribeToResourceInvalidation('stats', () => pathsOverviewResource.expireAll());
