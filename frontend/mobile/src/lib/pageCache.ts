const MAX_AGE = 24 * 60 * 60 * 1000;
const entries = new Map<string, { value: unknown; savedAt: number }>();
const pending = new Map<string, Promise<unknown>>();

export function readPage<T>(key: string): { value: T } | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.savedAt >= MAX_AGE) {
    entries.delete(key);
    return undefined;
  }
  return { value: entry.value as T };
}

export function writePage<T>(key: string, value: T): void {
  pending.delete(key);
  entries.set(key, { value, savedAt: Date.now() });
}

export function clearPageCache(): void {
  entries.clear();
  pending.clear();
}

export function invalidatePages(prefixes: readonly string[]): void {
  for (const key of new Set([...entries.keys(), ...pending.keys()])) {
    if (prefixes.some(prefix => key.startsWith(prefix))) {
      entries.delete(key);
      pending.delete(key);
    }
  }
}

// Mutations and account changes must not allow older requests to repopulate snapshots.
export async function loadPage<T>(key: string, loader: () => Promise<T>, force = false): Promise<T> {
  const cached = !force && readPage<T>(key);
  if (cached) return cached.value;
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const request = loader().then(value => {
    if (pending.get(key) === request) writePage(key, value);
    return value;
  });
  pending.set(key, request);
  try {
    return await request;
  } finally {
    if (pending.get(key) === request) pending.delete(key);
  }
}
