import { TtlCache } from './ttlCache.ts';

export interface RevalidatingEntry<T> {
    value: T;
    fetchedAt: number;
}

/**
 * Keeps the last value per key so a view can show it at once while it refetches
 * (stale-while-revalidate). Unlike `CachedResource`, freshness is decided by the
 * caller, so an expired value is still there to show during the refresh; the TTL
 * only bounds how long anything is kept at all.
 */
export class RevalidatingResource<T> {
    private readonly cache: TtlCache<RevalidatingEntry<T>>;
    private readonly requests = new Map<string, Promise<T>>();
    private generation = 0;

    constructor(options: { keepMs: number; maxEntries: number }) {
        this.cache = new TtlCache({ ttlMs: options.keepMs, maxEntries: options.maxEntries });
    }

    peek(key: string): RevalidatingEntry<T> | undefined {
        return this.cache.getStale(key);
    }

    isFresh(key: string, freshMs: number): boolean {
        const entry = this.peek(key);
        return entry !== undefined && Date.now() - entry.fetchedAt < freshMs;
    }

    /** Fetches now, sharing a request already in flight for the key. */
    refresh(key: string, loader: () => Promise<T>): Promise<T> {
        const pending = this.requests.get(key);
        if (pending) return pending;
        const generation = this.generation;
        const request = loader()
            .then(value => {
                if (generation === this.generation) this.cache.set(key, { value, fetchedAt: Date.now() });
                return value;
            })
            .finally(() => {
                if (this.requests.get(key) === request) this.requests.delete(key);
            });
        this.requests.set(key, request);
        return request;
    }

    /** Stores a value the caller already has, e.g. what a save returned. */
    set(key: string, value: T): void {
        this.cache.set(key, { value, fetchedAt: Date.now() });
    }

    /** Fetches only when the kept value is older than `freshMs`, e.g. to prefetch. */
    async ensure(key: string, loader: () => Promise<T>, freshMs: number): Promise<T> {
        const entry = this.peek(key);
        if (entry && Date.now() - entry.fetchedAt < freshMs) return entry.value;
        return this.refresh(key, loader);
    }

    /** Keeps values on screen but makes the next view refetch them. */
    expireAll(): void {
        for (const key of this.cache.keys()) {
            const entry = this.peek(key);
            if (entry) this.cache.set(key, { ...entry, fetchedAt: 0 });
        }
    }

    clear(): void {
        this.generation += 1;
        this.requests.clear();
        this.cache.clear();
    }
}
