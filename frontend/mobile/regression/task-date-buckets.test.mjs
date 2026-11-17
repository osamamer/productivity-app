import assert from 'node:assert/strict';
import test from 'node:test';
import { displayDayDate, localDate, taskDateBucket } from '../src/lib/date.ts';

test('mobile Home and Tasks bucket the previous date as Today before the day ends', () => {
  const beforeEnd = localDate(displayDayDate(new Date(2026, 10, 17, 2, 30), 4));
  assert.equal(taskDateBucket('2026-11-16T22:00:00', beforeEnd), 'today');
  assert.equal(taskDateBucket('2026-11-17T02:00:00', beforeEnd), 'future');
  assert.equal(taskDateBucket('2026-11-15T10:00:00', beforeEnd), 'past');

  const afterEnd = localDate(displayDayDate(new Date(2026, 10, 17, 4, 0), 4));
  assert.equal(taskDateBucket('2026-11-16T22:00:00', afterEnd), 'past');
  assert.equal(taskDateBucket('2026-11-17T02:00:00', afterEnd), 'today');
});
