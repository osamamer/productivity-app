const STORAGE_KEY_PREFIX = 'solife.stat-groups';

export function statGroupPreferencesStorageKey(userId: string | undefined): string {
    return `${STORAGE_KEY_PREFIX}.${userId ?? 'signed-out'}.open`;
}

export function readOpenStatGroupIds(storageKey: string): Set<string> {
    try {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return new Set();

        const parsed: unknown = JSON.parse(stored);
        return new Set(
            Array.isArray(parsed) ? parsed.filter((groupId): groupId is string => typeof groupId === 'string') : [],
        );
    } catch (cause) {
        console.warn('Could not load statistic group display preferences:', cause);
        return new Set();
    }
}

export function writeOpenStatGroupIds(storageKey: string, groupIds: Set<string>): void {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify([...groupIds]));
    } catch (cause) {
        console.warn('Could not save statistic group display preferences:', cause);
    }
}
