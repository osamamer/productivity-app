import assert from 'node:assert/strict';
import test from 'node:test';
import { dayRange, eventDayMinutes, layoutDayItems } from '../src/lib/dayCalendarLayout.ts';

const item = (id, startMinute, endMinute) => ({ id, startMinute, endMinute, kind: 'calendarEvent' });

test('day navigation uses one local calendar day across month and year boundaries', () => {
  const { start, end } = dayRange(new Date(2026, 11, 31, 17));
  assert.equal(start.getHours(), 0);
  assert.equal(end.getFullYear(), 2027);
  assert.equal(end.getMonth(), 0);
  assert.equal(end.getDate(), 1);
});

test('overnight events are clipped to each day and midnight ends at the bottom of the prior day', () => {
  assert.deepEqual(eventDayMinutes('2026-11-26T23:00:00', '2026-11-27T02:00:00', '2026-11-26'), { startMinute: 1380, endMinute: 1440 });
  assert.deepEqual(eventDayMinutes('2026-11-26T23:00:00', '2026-11-27T02:00:00', '2026-11-27'), { startMinute: 0, endMinute: 120 });
  assert.deepEqual(eventDayMinutes('2026-11-26T22:00:00', '2026-11-27T00:00:00', '2026-11-26'), { startMinute: 1320, endMinute: 1440 });
});

test('overlapping events share columns while later events regain full width', () => {
  const result = layoutDayItems([item('a', 540, 660), item('b', 570, 600), item('c', 600, 690), item('d', 720, 780), { id: 'all-day' }]);
  assert.deepEqual(result.map(({ item, lane, lanes }) => [item.id, lane, lanes]), [
    ['a', 0, 2], ['b', 1, 2], ['c', 1, 2], ['d', 0, 1],
  ]);
});

test('short tasks reserve enough room to remain selectable and use separate columns', () => {
  const result = layoutDayItems([item('task', 600), item('event', 610, 670)]);
  assert.equal(result[0].end, 630);
  assert.equal(result[0].lanes, 2);
});
