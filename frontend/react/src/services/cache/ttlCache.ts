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

    /**
     * Returns an expired value without extending its freshness or removing it.
     * Read views use this during background refreshes to avoid flashing empty UI.
     */
    getStale(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;

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

export class CachedResource<T> {
    private readonly cache: TtlCache<T>;
    private readonly requests = new Map<string, Promise<T>>();
    private generation = 0;
    private readonly keyVersions = new Map<string, number>();

    constructor(options: TtlCacheOptions) {
        this.cache = new TtlCache<T>(options);
    }

    async get(key: string, loader: () => Promise<T>, ttlMs?: number): Promise<T> {
        const cached = this.cache.get(key);
        if (cached !== undefined) return cached;

        const pendingRequest = this.requests.get(key);
        if (pendingRequest) return pendingRequest;

        const generation = this.generation;
        const keyVersion = this.keyVersions.get(key) ?? 0;
        const request = loader().then(value => {
            if (generation === this.generation && keyVersion === (this.keyVersions.get(key) ?? 0)) {
                this.cache.set(key, value, ttlMs);
            }
            return value;
        });

        this.requests.set(key, request);
        try {
            return await request;
        } finally {
            if (this.requests.get(key) === request) this.requests.delete(key);
        }
    }

    getCached(key: string): T | undefined {
        return this.cache.get(key);
    }

    getStale(key: string): T | undefined {
        return this.cache.getStale(key);
    }

    set(key: string, value: T, ttlMs?: number): void {
        this.keyVersions.set(key, (this.keyVersions.get(key) ?? 0) + 1);
        this.cache.set(key, value, ttlMs);
    }

    invalidate(key: string): void {
        this.cache.delete(key);
        this.keyVersions.set(key, (this.keyVersions.get(key) ?? 0) + 1);
        this.requests.delete(key);
    }

    clear(): void {
        this.cache.clear();
        this.requests.clear();
        this.generation += 1;
        this.keyVersions.clear();
    }
}
