import assert from 'node:assert/strict';
import test from 'node:test';
import {
  averageTimeValues,
  durationValueToMinutes,
  formatDurationValue,
  formatTimeValue,
  getTimeDisplayScale,
  isTimeAtOrBeforeThreshold,
  minutesToDurationValue,
  minutesToTimeValue,
  timeValueFromDisplayScale,
  timeValueToDisplayScale,
  timeValueToMinutes,
} from '../src/services/utils/statValues.ts';

test('maps sleep and wake times onto their configured display scales', () => {
  const sleep = { systemKey: 'sleep_time' };
  const wake = { systemKey: 'wake_up_time' };

  assert.equal(timeValueToDisplayScale(sleep, 22 * 60), 0);
  assert.equal(timeValueToDisplayScale(sleep, 7 * 60), 9 * 60);
  assert.equal(timeValueFromDisplayScale(sleep, 9 * 60), 7 * 60);
  assert.equal(timeValueToDisplayScale(wake, 7 * 60), 0);
  assert.equal(timeValueToDisplayScale(wake, 14 * 60), 7 * 60);
  assert.equal(getTimeDisplayScale({ systemKey: 'custom' }), null);
});

test('compares bedtime thresholds across midnight in bedtime order', () => {
  const sleep = { systemKey: 'sleep_time' };

  assert.equal(isTimeAtOrBeforeThreshold(sleep, 21 * 60, 22 * 60), true);
  assert.equal(isTimeAtOrBeforeThreshold(sleep, 23 * 60, 22 * 60), false);
});

test('averages bedtime values across midnight without averaging through midday', () => {
  assert.equal(averageTimeValues({ systemKey: 'sleep_time' }, [23 * 60, 60]), 0);
  assert.equal(averageTimeValues({ systemKey: 'sleep_time' }, []), null);
});

test('parses valid clock times and rejects out-of-range or malformed input', () => {
  assert.equal(timeValueToMinutes('23:59'), 1_439);
  assert.equal(timeValueToMinutes('24:00'), null);
  assert.equal(timeValueToMinutes('12:60'), null);
  assert.equal(timeValueToMinutes('9:05'), null);
  assert.equal(minutesToTimeValue(725), '12:05');
  assert.equal(minutesToTimeValue(1_440), '');
});

test('parses multi-hour durations and rejects invalid minutes', () => {
  assert.equal(durationValueToMinutes(' 25:07 '), 1_507);
  assert.equal(durationValueToMinutes('2:60'), null);
  assert.equal(durationValueToMinutes('-1:00'), null);
  assert.equal(minutesToDurationValue(1_507), '25:07');
  assert.equal(minutesToDurationValue(-1), '');
  assert.equal(formatDurationValue(90), '1.5H');
});

test('formats midnight and rejects values outside the displayed day', () => {
  assert.equal(formatTimeValue(0), '12:00 AM');
  assert.equal(formatTimeValue(1_440), '12:00 AM');
  assert.equal(formatTimeValue(1_441), '—');
});
