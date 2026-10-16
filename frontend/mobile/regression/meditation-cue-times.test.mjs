import assert from 'node:assert/strict';
import test from 'node:test';
import { remainingIntervalBellOffsets } from '../src/lib/meditationCueTimes.ts';

test('places all interval bells on the native session timeline', () => {
  assert.deepEqual(remainingIntervalBellOffsets(600, 0, 2), [200, 400]);
});

test('restored sessions schedule only future bells at their remaining offsets', () => {
  assert.deepEqual(remainingIntervalBellOffsets(600, 250, 2), [150]);
  assert.deepEqual(remainingIntervalBellOffsets(600, 400, 2), []);
});
