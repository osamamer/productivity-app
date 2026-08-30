export interface TtlCacheOptions {
    ttlMs: number;
    maxEntries: number;
}

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * A small in-memory LRU cache for data that is safe to discard and refetch.
 * It intentionally has both a TTL and a size limit so a long-lived browser tab
 * cannot retain unbounded or indefinitely stale application data.
 */
export class TtlCache<T> {
    private readonly entries = new Map<string, CacheEntry<T>>();

    constructor(private readonly options: TtlCacheOptions) {
        if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) {
            throw new Error('A cache TTL must be a positive number');
        }
        if (!Number.isInteger(options.maxEntries) || options.maxEntries <= 0) {
            throw new Error('A cache size limit must be a positive integer');
        }
    }

    get(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;

        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }

        // Reinsert to make the Map's insertion order represent recency.
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.value;
    }

    set(key: string, value: T, ttlMs = this.options.ttlMs): void {
        if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
            throw new Error('A cache entry TTL must be a positive number');
        }

        this.entries.delete(key);
        this.entries.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });

        while (this.entries.size > this.options.maxEntries) {
            const oldestKey = this.entries.keys().next().value as string | undefined;
            if (oldestKey === undefined) break;
            this.entries.delete(oldestKey);
        }
    }

    delete(key: string): void {
        this.entries.delete(key);
    }

    deleteMatching(predicate: (key: string) => boolean): void {
        for (const key of this.entries.keys()) {
            if (predicate(key)) this.entries.delete(key);
        }
    }

    clear(): void {
        this.entries.clear();
    }
}
