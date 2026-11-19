import type { StatAverageKind } from '../../components/stats/statSummaryValues';

const STORAGE_KEY_PREFIX = 'solife.stat-view';

/** How one stat's summary is shown on the Stats page; remembered per user and stat on this device. */
export type StatViewPreferences = {
    averageKind: StatAverageKind;
    // Null follows the stat's own setting from before this became a Stats page choice.
    countUnloggedDays: boolean | null;
};

const DEFAULT_PREFERENCES: StatViewPreferences = { averageKind: 'mean', countUnloggedDays: null };

export function statViewPreferencesStorageKey(userId: string | undefined, definitionId: string): string {
    return `${STORAGE_KEY_PREFIX}.${userId ?? 'signed-out'}.${definitionId}`;
}

export function readStatViewPreferences(storageKey: string): StatViewPreferences {
    try {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return DEFAULT_PREFERENCES;
        const parsed = JSON.parse(stored) as Partial<StatViewPreferences> | null;
        return {
            averageKind: parsed?.averageKind === 'median' ? 'median' : 'mean',
            countUnloggedDays: typeof parsed?.countUnloggedDays === 'boolean' ? parsed.countUnloggedDays : null,
        };
    } catch (cause) {
        console.warn('Could not load statistic view preferences:', cause);
        return DEFAULT_PREFERENCES;
    }
}

export function writeStatViewPreferences(storageKey: string, preferences: StatViewPreferences): void {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch (cause) {
        console.warn('Could not save statistic view preferences:', cause);
    }
}
