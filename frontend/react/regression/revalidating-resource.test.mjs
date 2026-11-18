import assert from 'node:assert/strict';
import test from 'node:test';
import { RevalidatingResource } from '../src/services/cache/revalidatingResource.ts';

const resource = () => new RevalidatingResource({ keepMs: 60_000, maxEntries: 4 });

test('a refreshed value can be shown at once next time, with when it was fetched', async () => {
  const days = resource();
  assert.equal(days.peek('mon'), undefined);
  await days.refresh('mon', async () => 'plan');
  assert.equal(days.peek('mon').value, 'plan');
  assert.ok(days.isFresh('mon', 1_000));
});

test('callers asking at the same time share one request', async () => {
  const days = resource();
  let calls = 0;
  const loader = async () => { calls += 1; return calls; };
  const [a, b] = await Promise.all([days.refresh('mon', loader), days.refresh('mon', loader)]);
  assert.deepEqual([a, b, calls], [1, 1, 1]);
});

test('ensure skips the request while the kept value is fresh, e.g. for prefetching', async () => {
  const days = resource();
  let calls = 0;
  const loader = async () => { calls += 1; return 'plan'; };
  await days.ensure('mon', loader, 60_000);
  await days.ensure('mon', loader, 60_000);
  assert.equal(calls, 1);
});

test('expiring keeps values on screen but makes them due for a refetch', async () => {
  const days = resource();
  await days.refresh('mon', async () => 'plan');
  days.expireAll();
  assert.equal(days.peek('mon').value, 'plan');
  assert.equal(days.isFresh('mon', 60_000), false);
});

test('a request that started before clear() does not bring old data back', async () => {
  const days = resource();
  let release;
  const pending = days.refresh('mon', () => new Promise(resolve => { release = resolve; }));
  days.clear();
  release('old account');
  await pending;
  assert.equal(days.peek('mon'), undefined);
});
