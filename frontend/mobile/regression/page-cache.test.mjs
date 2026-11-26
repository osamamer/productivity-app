import assert from 'node:assert/strict';
import test from 'node:test';
import { clearPageCache, invalidatePages, loadPage, readPage, writePage } from '../src/lib/pageCache.ts';

test('returning to a page reuses its snapshot and warming shares an in-flight read', async () => {
  clearPageCache();
  let finish;
  let calls = 0;
  const loader = () => { calls += 1; return new Promise(resolve => { finish = resolve; }); };
  const warm = loadPage('threads', loader);
  const open = loadPage('threads', loader);
  const threads = [{ id: 'thread' }];
  finish(threads);
  assert.equal(await warm, threads);
  assert.equal(await open, threads);
  assert.equal(await loadPage('threads', loader), threads);
  assert.equal(calls, 1);
});

test('refresh bypasses a snapshot and preserves it if the network fails', async () => {
  clearPageCache();
  writePage('notes', ['saved']);
  await assert.rejects(loadPage('notes', async () => { throw new Error('offline'); }, true));
  assert.deepEqual(readPage('notes').value, ['saved']);
  assert.deepEqual(await loadPage('notes', async () => ['fresh'], true), ['fresh']);
});

test('a write or logout prevents a delayed read from restoring invalidated data', async () => {
  clearPageCache();
  let finish;
  const old = loadPage('notes', () => new Promise(resolve => { finish = resolve; }));
  clearPageCache();
  await loadPage('notes', async () => ['new account']);
  finish(['old account']);
  await old;
  assert.deepEqual(readPage('notes').value, ['new account']);
});

test('snapshots expire at one day and remain separate by route and date', () => {
  clearPageCache();
  const now = Date.now;
  let clock = now();
  Date.now = () => clock;
  try {
    writePage('stat:first:2026-11-26', ['first']);
    assert.equal(readPage('stat:second:2026-11-26'), undefined);
    assert.equal(readPage('stat:first:2026-11-27'), undefined);
    clock += 24 * 60 * 60 * 1000;
    assert.equal(readPage('stat:first:2026-11-26'), undefined);
  } finally { Date.now = now; }
});

test('saving a note invalidates affected pages while preserving unrelated warm reads', async () => {
  clearPageCache();
  writePage('notes', ['old']);
  writePage('note:first', { title: 'old' });
  writePage('events', [{ id: 'meeting' }]);
  let finish;
  const warm = loadPage('mental-threads', () => new Promise(resolve => { finish = resolve; }));
  invalidatePages(['notes', 'note:']);
  finish(['thread']);
  await warm;
  assert.equal(readPage('notes'), undefined);
  assert.equal(readPage('note:first'), undefined);
  assert.deepEqual(readPage('events').value, [{ id: 'meeting' }]);
  assert.deepEqual(readPage('mental-threads').value, ['thread']);
});

test('an optimistic page update wins over an older delayed request', async () => {
  clearPageCache();
  let finish;
  const read = loadPage('notes', () => new Promise(resolve => { finish = resolve; }));
  writePage('notes', ['edited']);
  finish(['before edit']);
  await read;
  assert.deepEqual(readPage('notes').value, ['edited']);
});
