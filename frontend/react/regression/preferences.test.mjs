import assert from 'node:assert/strict';
import test from 'node:test';
import { PendingPreferenceUpdates } from '../src/services/api/pendingPreferenceUpdates.ts';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('a delayed mode save does not revert a newer accent selection', async () => {
  const pending = new PendingPreferenceUpdates();
  const cacheKey = 'user-1';
  const firstResponse = deferred();

  pending.record(cacheKey, 1, { themeMode: 'dark' });
  const firstSave = firstResponse.promise.then(serverPreferences => {
    const visiblePreferences = pending.mergeNewer(cacheKey, serverPreferences, 1);
    pending.removeThrough(cacheKey, 1);
    return visiblePreferences;
  });

  pending.record(cacheKey, 2, { accentColor: 'sage' });
  firstResponse.resolve({ themeMode: 'dark', accentColor: 'violet' });

  assert.deepEqual(await firstSave, { themeMode: 'dark', accentColor: 'sage' });

  const secondResponse = { themeMode: 'dark', accentColor: 'sage' };
  const settledPreferences = pending.mergeNewer(cacheKey, secondResponse, 2);
  pending.removeThrough(cacheKey, 2);
  assert.deepEqual(settledPreferences, { themeMode: 'dark', accentColor: 'sage' });
});

test('a failed preference change rolls back without undoing a newer setting change', () => {
  const pending = new PendingPreferenceUpdates();
  const cacheKey = 'user-1';
  const savedPreferences = { themeMode: 'dark', accentColor: 'violet' };

  pending.record(cacheKey, 2, { accentColor: 'sage' });
  pending.removeThrough(cacheKey, 2);
  pending.record(cacheKey, 3, { themeMode: 'light' });

  assert.deepEqual(pending.mergeNewer(cacheKey, savedPreferences, 0), {
    themeMode: 'light',
    accentColor: 'violet',
  });
});
