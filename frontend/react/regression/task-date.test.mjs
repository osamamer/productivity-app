import assert from 'node:assert/strict';
import test from 'node:test';
import { taskDateKey } from '../src/services/utils/taskDate.ts';

test('keeps backend local date-time calendar dates intact', () => {
  assert.equal(taskDateKey('2026-10-07T00:20:00'), '2026-10-07');
  assert.equal(taskDateKey('2026-10-07'), '2026-10-07');
});

test('converts zoned timestamps to the browser local calendar date', () => {
  const value = '2026-10-07T00:20:00+03:00';
  const local = new Date(value);
  const expected = [
    local.getFullYear(),
    String(local.getMonth() + 1).padStart(2, '0'),
    String(local.getDate()).padStart(2, '0'),
  ].join('-');

  assert.equal(taskDateKey(value), expected);
});

test('returns an empty key for an invalid timestamp', () => {
  assert.equal(taskDateKey('not-a-date'), '');
});
