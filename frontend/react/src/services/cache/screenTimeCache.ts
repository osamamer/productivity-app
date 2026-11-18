import { UsageDailyTotals, UsageRange, UsageStatus } from '../desktop';
import { RevalidatingResource } from './revalidatingResource';

// Screen time lives on this computer, not in an account, so keys carry no auth scope.
const KEEP_MS = 24 * 60 * 60 * 1000;
// Settings change only through this app, which stores what a save returns.
export const STATUS_FRESH_MS = 5 * 60_000;
// A window that ended this long ago will not change any more.
const SETTLED_AFTER_MS = 2 * 60_000;
// Reports include today, but switching periods back and forth need not reread a year of files.
export const TOTALS_FRESH_MS = 60_000;
export const LIVE_REFRESH_MS = 60_000;

export const screenStatusResource = new RevalidatingResource<UsageStatus>({ keepMs: KEEP_MS, maxEntries: 1 });
export const screenRangeResource = new RevalidatingResource<UsageRange>({ keepMs: KEEP_MS, maxEntries: 30 });
export const screenTotalsResource = new RevalidatingResource<UsageDailyTotals>({ keepMs: KEEP_MS, maxEntries: 8 });

export const SCREEN_STATUS_KEY = 'status';

export function screenRangeKey(start: number, end: number): string {
    return `${start}:${end}`;
}

/** Past windows are kept for good; one that includes now is refetched on open and every minute. */
export function isSettledWindow(end: number, now = Date.now()): boolean {
    return end <= now - SETTLED_AFTER_MS;
}
