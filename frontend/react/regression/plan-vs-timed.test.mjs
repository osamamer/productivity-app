import assert from 'node:assert/strict';
import test from 'node:test';
import { compareByActivity, compareByBucket, timedSpan } from '../src/components/wellbeing/planVsTimed.ts';
import { reportWindow } from '../src/components/wellbeing/screenTimeReport.ts';

const H = 3_600_000;
const now = new Date(2026, 10, 18, 15, 0).getTime();
const at = (day, hour) => new Date(2026, 10, day, hour).getTime();
const span = (activityId, day, from, to) => ({ activityId, start: at(day, from), end: at(day, to) });
const week = reportWindow('week', new Date(now));

test('planned and timed hours add up per activity across the period', () => {
  const planned = [span('focus', 17, 9, 12), span('focus', 18, 9, 12), span('leisure', 17, 19, 21)];
  const timed = [span('focus', 17, 9, 11), span('focus', 18, 10, 11), span(null, 18, 13, 14)];
  const rows = compareByActivity(planned, timed, week, now);
  assert.deepEqual(rows.map(r => [r.activityId, r.plannedMs / H, r.timedMs / H]), [
    ['focus', 6, 3], ['leisure', 2, 0], [null, 0, 1],
  ]);
});

test('a chunk later today does not count as planned yet', () => {
  const rows = compareByActivity([span('gym', 18, 17, 18), span('gym', 18, 14, 16)], [], week, now);
  assert.equal(rows[0].plannedMs, H);
});

test('time outside the period is left out', () => {
  const rows = compareByActivity([span('focus', 1, 9, 12)], [span('focus', 11, 23, 25)], week, now);
  assert.deepEqual(rows.map(r => r.timedMs / H), [1]);
});

test('each day of the week gets its own planned and timed total', () => {
  const buckets = compareByBucket([span('focus', 17, 9, 12)], [span('focus', 17, 9, 11), span('rest', 18, 8, 9)], 'week', week, now);
  assert.equal(buckets.length, 7);
  assert.deepEqual(buckets.slice(-2).map(b => [b.plannedMs / H, b.timedMs / H]), [[3, 2], [0, 1]]);
});

test('a timer covers its counted time from its start, leaving pauses out', () => {
  const session = { id: 's', activityId: 'focus', eventId: null, title: '', startedAt: new Date(at(18, 9)).toISOString(),
    endedAt: new Date(at(18, 12)).toISOString(), pausedAt: null, pausedMillis: H, targetEndAt: null, elapsedSeconds: 0, active: false, paused: false };
  const timed = timedSpan(session, now);
  assert.equal(timed.end - timed.start, 2 * H);
});
