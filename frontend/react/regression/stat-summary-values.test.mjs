import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let values;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  values = await viteServer.ssrLoadModule('/src/components/stats/statSummaryValues.ts');
});

after(async () => {
  await viteServer?.close();
});

const number = { type: 'NUMBER', morality: 'GOOD' };

test('the median ignores a single outlier that drags the mean', () => {
  assert.equal(values.statPeriodAverage(number, [2, 3, 4, 100], 'mean'), 27.25);
  assert.equal(values.statPeriodAverage(number, [2, 3, 4, 100], 'median'), 3.5);
  assert.equal(values.statPeriodAverage(number, [5, 1, 3], 'median'), 3);
});

test('unlogged days count as zeroes only when asked to', () => {
  assert.equal(values.statPeriodAverage(number, [6, 6], 'mean', 2), 3);
  assert.equal(values.statPeriodAverage(number, [6, 6], 'median', 2), 3);
  assert.equal(values.statPeriodAverage(number, [], 'mean', 3), 0);
  assert.equal(values.statPeriodAverage(number, [], 'mean'), null);
});

test('unlogged days run from the first eligible day to the end of the period', () => {
  assert.equal(values.unloggedDayCount(2, '2026-11-10', '2026-11-16'), 5);
  assert.equal(values.unloggedDayCount(2, null, '2026-11-16'), 0);
});

test('sleep hours never count unlogged nights as zero', () => {
  assert.equal(values.supportsUnloggedDaysAsZero('DURATION', 'sleep_hours'), false);
  assert.equal(values.supportsUnloggedDaysAsZero('DURATION', undefined), true);
  assert.equal(values.supportsUnloggedDaysAsZero('TIME', undefined), false);
});

test('the best in a period follows the stat direction', () => {
  assert.equal(values.statPeriodBest(number, [3, 9, 5]), 9);
  assert.equal(values.statPeriodBest({ type: 'NUMBER', morality: 'BAD' }, [3, 9, 5]), 3);
  assert.equal(values.statPeriodBest({ type: 'TIME', morality: 'GOOD' }, [420, 360, 480]), 360);
  assert.equal(values.statPeriodBest(number, []), null);
});
