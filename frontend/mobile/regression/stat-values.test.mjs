import assert from 'node:assert/strict';
import test from 'node:test';
import * as mobile from '../src/lib/statValues.ts';
import * as web from '../../react/src/services/utils/statValues.ts';

test('web and mobile agree on sleep-time scaling, round trips, and overnight averages', () => {
  const definitions = [
    { systemKey: 'sleep_time' },
    { systemKey: 'wake_up_time' },
    { systemKey: 'custom_time' },
  ];

  definitions.forEach(definition => {
    [0, 60, 420, 1_320, 1_439].forEach(value => {
      assert.equal(
        mobile.timeValueToDisplayScale(definition, value),
        web.timeValueToDisplayScale(definition, value),
      );
      assert.equal(
        mobile.timeValueFromDisplayScale(definition, value),
        web.timeValueFromDisplayScale(definition, value),
      );
    });
    assert.equal(
      mobile.averageTimeValues(definition, [23 * 60, 60]),
      web.averageTimeValues(definition, [23 * 60, 60]),
    );
  });
});

test('web and mobile agree on time, duration, and formatting boundaries', () => {
  ['00:00', '09:05', '23:59', '24:00', '12:60', '9:05'].forEach(value => {
    assert.equal(mobile.timeValueToMinutes(value), web.timeValueToMinutes(value));
  });
  [0, 89, 90, 1_507, -1].forEach(value => {
    assert.equal(mobile.minutesToTimeValue(value), web.minutesToTimeValue(value));
    assert.equal(mobile.minutesToDurationValue(value), web.minutesToDurationValue(value));
    assert.equal(mobile.formatDurationValue(value), web.formatDurationValue(value));
  });
  ['0:00', '1:30', '25:07', '2:60', '-1:00'].forEach(value => {
    assert.equal(mobile.durationValueToMinutes(value), web.durationValueToMinutes(value));
  });
});

test('formats duration input into mobile hour and minute fields', () => {
  assert.deepEqual(mobile.minutesToDurationParts(1_507), { hours: '25', minutes: '07' });
  assert.deepEqual(mobile.minutesToDurationParts(-1), { hours: '', minutes: '' });
});
