// Structural sharing for refetched JSON: whatever did not change keeps its old object, so
// React skips it (same reference) and only what was added, removed or edited re-renders.

type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
    if (value === null || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

// Records are matched by their id, so an insertion does not make every later row look new.
const ID_FIELDS = ['id', 'taskId', 'sessionId'] as const;

function identity(value: unknown): string | null {
    if (!isPlainObject(value)) return null;
    for (const field of ID_FIELDS) {
        const id = value[field];
        if (typeof id === 'string' || typeof id === 'number') return `${field}:${id}`;
    }
    return null;
}

function keepArray(previous: unknown[], next: unknown[]): unknown[] {
    const previousById = new Map<string, unknown>();
    for (const item of previous) {
        const id = identity(item);
        if (id !== null) previousById.set(id, item);
    }
    let changed = previous.length !== next.length;
    const merged = next.map((item, index) => {
        const id = identity(item);
        const candidate = id !== null ? previousById.get(id) : previous[index];
        const kept = candidate === undefined ? item : keepUnchanged(candidate, item);
        if (kept !== previous[index]) changed = true;
        return kept;
    });
    return changed ? merged : previous;
}

function keepObject(previous: Plain, next: Plain): Plain {
    const nextKeys = Object.keys(next);
    let changed = nextKeys.length !== Object.keys(previous).length;
    const merged: Plain = {};
    for (const key of nextKeys) {
        merged[key] = key in previous ? keepUnchanged(previous[key], next[key]) : next[key];
        if (merged[key] !== previous[key] || !(key in previous)) changed = true;
    }
    return changed ? merged : previous;
}

/** `next`, reusing every part of `previous` that is deeply equal to it. */
export function keepUnchanged<T>(previous: T, next: T): T {
    if (Object.is(previous, next)) return previous;
    if (Array.isArray(previous) && Array.isArray(next)) return keepArray(previous, next) as T;
    if (isPlainObject(previous) && isPlainObject(next)) return keepObject(previous, next) as T;
    return next;
}
