import assert from 'node:assert/strict';
import test from 'node:test';
import { formatClock, timeByActivity } from '../src/components/leisure/leisureTime.ts';

const H = 3_600_000;
const day = Date.UTC(2026, 10, 18);
const session = (activityId, from, to, extra = {}) => ({
  id: `${activityId}-${from}`, activityId, eventId: null, title: '', pausedMillis: 0, pausedAt: null,
  targetEndAt: null, elapsedSeconds: 0, active: to === null, paused: false,
  startedAt: new Date(day + from * H).toISOString(), endedAt: to === null ? null : new Date(day + to * H).toISOString(), ...extra,
});

test('timed hours add up per activity, a running timer counting up to now', () => {
  const totals = timeByActivity([session('focus', 9, 10), session('leisure', 19, null), session('focus', 14, 15.5)], day + 20 * H);
  assert.deepEqual(totals.map(t => [t.activityId, t.ms / H]), [['focus', 2.5], ['leisure', 1]]);
});

test('paused time is left out of the totals', () => {
  const totals = timeByActivity([session('focus', 9, 11, { pausedMillis: 0.5 * H })], day + 12 * H);
  assert.equal(totals[0].ms, 1.5 * H);
});

test('the clock shows seconds, and hours only when needed', () => {
  assert.equal(formatClock(65_000), '1:05');
  assert.equal(formatClock(H + 2 * 60_000 + 5_000), '1:02:05');
});
