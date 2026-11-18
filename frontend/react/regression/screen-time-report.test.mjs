import assert from 'node:assert/strict';
import test from 'node:test';
import { bucketDays, reportAppTimes, reportSummary, reportWindow } from '../src/components/wellbeing/screenTimeReport.ts';

const HOUR = 3_600_000;
const now = new Date(2026, 10, 18, 15, 30);
const day = (date, apps) => ({ date, apps, totalMs: Object.values(apps).reduce((total, ms) => total + ms, 0) });

test('a period ends with today and covers whole local days', () => {
  const window = reportWindow('week', now);
  assert.deepEqual([window.from, window.to], [new Date(2026, 10, 12), new Date(2026, 10, 19)]);
});

test('a week is shown as one bar per day, including days with no screen time', () => {
  const window = reportWindow('week', now);
  const buckets = bucketDays([day('2026-11-18', { firefox: 2 * HOUR }), day('2026-11-12', { kitty: HOUR })], 'week', window);
  assert.equal(buckets.length, 7);
  assert.deepEqual(buckets.map(bucket => bucket.totalMs / HOUR), [1, 0, 0, 0, 0, 0, 2]);
});

test('three months are grouped into Monday weeks and a year into months', () => {
  const quarter = bucketDays([], 'quarter', reportWindow('quarter', now));
  assert.ok(quarter.every(bucket => bucket.unit === 'week' && bucket.start.getDay() === 1));
  const year = bucketDays([day('2026-11-02', { firefox: HOUR }), day('2026-11-17', { firefox: HOUR })], 'year', reportWindow('year', now));
  assert.equal(year.at(-1).totalMs, 2 * HOUR);
  assert.equal(year.at(-1).start.getMonth(), 10);
});

test('days outside the window are left out of every number', () => {
  const window = reportWindow('week', now);
  const days = [day('2026-11-01', { firefox: 9 * HOUR }), day('2026-11-17', { firefox: HOUR })];
  assert.equal(bucketDays(days, 'week', window).reduce((total, bucket) => total + bucket.totalMs, 0), HOUR);
  assert.equal(reportSummary(days, window).totalMs, HOUR);
});

test('the daily average only counts days that had screen time', () => {
  const summary = reportSummary([day('2026-11-17', { firefox: 3 * HOUR }), day('2026-11-18', { firefox: HOUR })], reportWindow('month', now));
  assert.deepEqual(summary, { totalMs: 4 * HOUR, daysWithScreenTime: 2, averageMs: 2 * HOUR });
});

test('app totals add up across days, longest first', () => {
  const apps = reportAppTimes([
    day('2026-11-17', { firefox: HOUR, kitty: 3 * HOUR }),
    day('2026-11-18', { firefox: 3 * HOUR }),
  ], reportWindow('week', now), appId => appId.toUpperCase());
  assert.deepEqual(apps.map(app => [app.name, app.ms / HOUR]), [['FIREFOX', 4], ['KITTY', 3]]);
});
