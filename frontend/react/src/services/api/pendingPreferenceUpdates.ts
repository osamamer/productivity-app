type PendingValue = { version: number; value: unknown };

export class PendingPreferenceUpdates<Preferences extends object> {
    private readonly updatesByKey = new Map<string, Map<keyof Preferences, PendingValue>>();

    record(cacheKey: string, version: number, updates: Partial<Preferences>): void {
        const pendingUpdates = this.updatesByKey.get(cacheKey)
            ?? new Map<keyof Preferences, PendingValue>();
        this.updatesByKey.set(cacheKey, pendingUpdates);

        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                pendingUpdates.set(key as keyof Preferences, { version, value });
            }
        });
    }

    mergeNewer(
        cacheKey: string,
        preferences: Preferences,
        afterVersion: number,
    ): Preferences {
        const pendingUpdates = this.updatesByKey.get(cacheKey);
        if (!pendingUpdates) return preferences;

        // PATCH responses are full snapshots, so later unsaved choices must take precedence.
        const merged = { ...preferences };
        pendingUpdates.forEach(({ version, value }, key) => {
            if (version > afterVersion) Object.assign(merged, { [key]: value });
        });
        return merged;
    }

    removeThrough(cacheKey: string, version: number): void {
        const pendingUpdates = this.updatesByKey.get(cacheKey);
        if (!pendingUpdates) return;

        pendingUpdates.forEach((pending, key) => {
            if (pending.version <= version) pendingUpdates.delete(key);
        });
        if (pendingUpdates.size === 0) this.updatesByKey.delete(cacheKey);
    }

    clear(): void {
        this.updatesByKey.clear();
    }
}
