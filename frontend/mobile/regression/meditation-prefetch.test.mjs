import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { clearPageCache, invalidatePages, loadPage, readPage } from '../src/lib/pageCache.ts';
import { pageInvalidationPrefixes } from '../src/lib/pageInvalidation.ts';

// Match Metro's extensionless TypeScript resolution when exercising the resource loader in Node.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { loadMeditationStats, meditationStatsRange } = await import('../src/services/meditationResources.ts');
hooks.deregister();

function statsSource() {
  const calls = [];
  return {
    calls,
    definitions: async () => {
      calls.push('definitions');
      return [{ id: 'practice', systemKey: 'meditated' }, { id: 'minutes', systemKey: 'meditation_minutes' }];
    },
    summary: async (id, from, to) => { calls.push(['summary', id, from, to]); return { periodTotal: 30 }; },
    entries: async (id, from, to) => { calls.push(['entries', id, from, to]); return [{ date: to, value: 1 }]; },
  };
}

test('Mental overview prefetch is reused by both meditation and its practice calendar', async () => {
  clearPageCache();
  const range = meditationStatsRange(0, new Date(2026, 10, 26));
  const source = statsSource();
  const load = () => loadMeditationStats(range.from, range.to, source);
  const prefetch = loadPage(range.key, load);
  const openingMeditation = loadPage(range.key, load);
  const data = await prefetch;
  assert.equal(await openingMeditation, data);
  assert.equal(readPage(range.key).value, data);
  assert.equal(await loadPage(range.key, load), data);
  assert.deepEqual(source.calls, [
    'definitions', ['summary', 'practice', '2026-11-01', '2026-11-26'],
    ['summary', 'minutes', '2026-11-01', '2026-11-26'], ['entries', 'practice', '2026-11-01', '2026-11-26'],
  ]);
  invalidatePages(pageInvalidationPrefixes('/api/v1/meditation/session/end'));
  assert.equal(readPage(range.key), undefined);
  await loadPage(range.key, load);
  assert.equal(source.calls.length, 7);
});

test('practice snapshots separate today, a new month, and previous months', () => {
  const today = new Date(2026, 2, 1);
  assert.equal(meditationStatsRange(0, today).key, 'stats:meditation:2026-03-01:2026-03-01');
  assert.equal(meditationStatsRange(-1, today).key, 'stats:meditation:2026-02-01:2026-02-28');
  assert.notEqual(meditationStatsRange(0, today).key, meditationStatsRange(0, new Date(2026, 2, 2)).key);
});

test('a prefetched empty active session is a loaded snapshot and meditation writes invalidate it', async () => {
  clearPageCache();
  await loadPage('meditation-active', async () => undefined);
  assert.ok(readPage('meditation-active'));
  assert.equal(readPage('meditation-active').value, undefined);
  invalidatePages(pageInvalidationPrefixes('/api/v1/meditation/session/pause'));
  assert.equal(readPage('meditation-active'), undefined);
});
