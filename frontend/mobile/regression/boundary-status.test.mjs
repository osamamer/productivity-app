import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyRule } from '../src/lib/boundaryRules.ts';
import { boundaryStatusRows, formatMinutes } from '../src/lib/boundaryStatus.ts';

const rule = (pkg, patch) => ({ ...emptyRule(pkg), ...patch });
const usage = patch => ({ usedMs: 0, opens: 0, sessionUsedMs: 0, sessionActive: false, ...patch });

test('a daily limit shows the time used and left today', () => {
  const [row] = boundaryStatusRows([rule('video', { dailyLimitMin: 30 })], { video: usage({ usedMs: 12 * 60_000, opens: 2 }) });

  assert.deepEqual(row.daily, { limitMs: 30 * 60_000, usedMs: 12 * 60_000, leftMs: 18 * 60_000 });
  assert.equal(row.opensLabel, '2 opens today');
  assert.equal(row.session, null);
});

test('time left never drops below zero once the limit is used up', () => {
  const [row] = boundaryStatusRows([rule('video', { dailyLimitMin: 10 })], { video: usage({ usedMs: 15 * 60_000 }) });
  assert.equal(row.daily.leftMs, 0);
});

test('an open limit counts against its maximum, and an unused app counts zero', () => {
  const [row] = boundaryStatusRows([rule('chat', { maxOpens: 3 })], {});
  assert.equal(row.opensLabel, '0 of 3 opens today');
  assert.equal(row.daily, null);
});

test('time per open shows what is left of the running open', () => {
  const rules = [rule('feed', { sessionMin: 10 })];

  assert.equal(boundaryStatusRows(rules, { feed: usage({ sessionActive: true, sessionUsedMs: 4 * 60_000 }) })[0].session, '6 min left in this open');
  assert.equal(boundaryStatusRows(rules, { feed: usage({ sessionActive: true }) })[0].live, true);
  assert.equal(boundaryStatusRows(rules, {})[0].session, 'No open running');
});

test('apps with nothing to count are left out', () => {
  const rows = boundaryStatusRows([
    rule('blocked', { blockMode: 'always', dailyLimitMin: 20 }),
    rule('paused-only', { delaySeconds: 30 }),
    rule('limited', { dailyLimitMin: 20 }),
  ], {});
  assert.deepEqual(rows.map(row => row.pkg), ['limited']);
});

test('durations round up to whole minutes and show hours past sixty', () => {
  assert.equal(formatMinutes(5_000), '1 min');
  assert.equal(formatMinutes(45 * 60_000), '45 min');
  assert.equal(formatMinutes(65 * 60_000), '1 h 05 min');
  assert.equal(formatMinutes(-1), '0 min');
});
