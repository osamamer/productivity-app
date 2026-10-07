import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCalendarOptions,
  filterByVisibleCalendar,
  initialCalendarId,
} from '../src/lib/calendarSelection.ts';

const calendars = [
  { id: 'default', name: 'Personal', isDefault: true, visible: false },
  { id: 'work', name: 'Work', isDefault: false, visible: true },
  { id: 'family', name: 'Family', isDefault: false, visible: true },
];

test('uses the only visible calendar as the creation destination', () => {
  assert.equal(initialCalendarId([
    calendars[0],
    { ...calendars[1], visible: true },
    { ...calendars[2], visible: false },
  ]), 'work');
});

test('uses the default when several calendars are visible or all are hidden', () => {
  assert.equal(initialCalendarId(calendars), 'default');
  assert.equal(initialCalendarId(calendars.map(calendar => ({ ...calendar, visible: false }))), 'default');
});

test('offers only visible calendars when there are multiple destinations', () => {
  assert.deepEqual(createCalendarOptions(calendars).map(calendar => calendar.id), ['work', 'family']);
  assert.deepEqual(createCalendarOptions([
    calendars[0],
    { ...calendars[1], visible: true },
    { ...calendars[2], visible: false },
  ]), []);
});

test('filters calendar items by active calendar visibility', () => {
  const items = [
    { id: 'task-default', calendarId: 'default' },
    { id: 'event-work', calendarId: 'work' },
    { id: 'event-deleted', calendarId: 'deleted-calendar' },
  ];

  assert.deepEqual(filterByVisibleCalendar(items, calendars).map(item => item.id), ['event-work']);
});
