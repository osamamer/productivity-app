import assert from 'node:assert/strict';
import test from 'node:test';
import { CachedResource, TtlCache } from '../src/services/cache/ttlCache.ts';

function withClock(run) {
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  try {
    run({ advance: milliseconds => { now += milliseconds; } });
  } finally {
    Date.now = originalNow;
  }
}

test('expires cached values at the TTL boundary', () => {
  withClock(({ advance }) => {
    const cache = new TtlCache({ ttlMs: 10, maxEntries: 2 });
    cache.set('task', { name: 'Draft' });

    advance(9);
    assert.deepEqual(cache.get('task'), { name: 'Draft' });
    advance(1);
    assert.equal(cache.get('task'), undefined);
  });
});

test('offers expired data as stale without making it fresh again', () => {
  withClock(({ advance }) => {
    const cache = new TtlCache({ ttlMs: 10, maxEntries: 2 });
    cache.set('task', 'last-known');
    advance(10);

    assert.equal(cache.getStale('task'), 'last-known');
    assert.equal(cache.get('task'), undefined);
  });
});

test('evicts the least recently used entry after a cache read', () => {
  const cache = new TtlCache({ ttlMs: 1_000, maxEntries: 2 });
  cache.set('first', 1);
  cache.set('second', 2);
  cache.get('first');
  cache.set('third', 3);

  assert.equal(cache.get('first'), 1);
  assert.equal(cache.get('second'), undefined);
  assert.equal(cache.get('third'), 3);
});

test('rejects non-positive cache limits and entry lifetimes', () => {
  assert.throws(() => new TtlCache({ ttlMs: 0, maxEntries: 1 }), /TTL must be a positive number/);
  assert.throws(() => new TtlCache({ ttlMs: 1, maxEntries: 0 }), /size limit must be a positive integer/);

  const cache = new TtlCache({ ttlMs: 1, maxEntries: 1 });
  assert.throws(() => cache.set('task', 1, -1), /entry TTL must be a positive number/);
});

test('coalesces concurrent loads and caches the resolved value', async () => {
  const resource = new CachedResource({ ttlMs: 1_000, maxEntries: 2 });
  let resolve;
  let loadCount = 0;
  const loader = () => {
    loadCount += 1;
    return new Promise(done => { resolve = done; });
  };

  const first = resource.get('tasks', loader);
  const second = resource.get('tasks', loader);
  assert.equal(loadCount, 1);

  resolve([{ taskId: 't1' }]);
  assert.deepEqual(await first, [{ taskId: 't1' }]);
  assert.deepEqual(await second, [{ taskId: 't1' }]);
  assert.deepEqual(resource.getCached('tasks'), [{ taskId: 't1' }]);
});

test('does not cache a request response after that key is invalidated', async () => {
  const resource = new CachedResource({ ttlMs: 1_000, maxEntries: 2 });
  let resolve;
  const pending = resource.get('tasks', () => new Promise(done => { resolve = done; }));
  resource.invalidate('tasks');
  resolve(['stale response']);

  await pending;
  assert.equal(resource.getCached('tasks'), undefined);
});

test('keeps a newer explicit value when an older request resolves later', async () => {
  const resource = new CachedResource({ ttlMs: 1_000, maxEntries: 2 });
  let resolve;
  const pending = resource.get('tasks', () => new Promise(done => { resolve = done; }));
  resource.set('tasks', ['newer state']);
  resolve(['older response']);

  await pending;
  assert.deepEqual(resource.getCached('tasks'), ['newer state']);
});

test('clearing a resource prevents all in-flight responses from refilling it', async () => {
  const resource = new CachedResource({ ttlMs: 1_000, maxEntries: 2 });
  let resolve;
  const pending = resource.get('tasks', () => new Promise(done => { resolve = done; }));
  resource.clear();
  resolve(['stale response']);

  await pending;
  assert.equal(resource.getCached('tasks'), undefined);
});
