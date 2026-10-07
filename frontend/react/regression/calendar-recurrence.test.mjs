import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let expandCalendarEvent;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true },
    logLevel: 'silent',
  });
  ({ expandCalendarEvent } = await viteServer.ssrLoadModule('/src/components/calendar/recurrence.ts'));
});

after(async () => {
  await viteServer?.close();
});

function event(overrides = {}) {
  return {
    id: 'event-1',
    title: 'Review planning',
    description: '',
    allDay: false,
    startDate: null,
    endDate: null,
    startTime: '2026-10-05T10:00:00.000Z',
    endTime: '2026-10-05T11:00:00.000Z',
    timeZone: 'UTC',
    status: 'CONFIRMED',
    recurrenceFrequency: 'WEEKLY',
    recurrenceEndDate: '2026-10-19',
    recurrenceInterval: null,
    recurrenceUnit: null,
    cancelledOccurrenceKeys: [],
    occurrenceOverrides: [],
    reminderMinutesBefore: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

test('expands through the inclusive recurrence end and shows a cancelled occurrence as cancelled', () => {
  const occurrences = expandCalendarEvent(
    event({ cancelledOccurrenceKeys: ['instant:2026-10-12T10:00:00.000Z'] }),
    new Date('2026-10-05T00:00:00.000Z'),
    new Date('2026-10-27T00:00:00.000Z'),
  );

  assert.deepEqual(occurrences.map(item => item.occurrenceDate), [
    '2026-10-05',
    '2026-10-12',
    '2026-10-19',
  ]);
  assert.deepEqual(occurrences.map(item => item.status), ['CONFIRMED', 'CANCELLED', 'CONFIRMED']);
});

test('finds a moved occurrence in its new date range without changing its series identity', () => {
  const originalKey = 'instant:2026-10-12T10:00:00.000Z';
  const occurrences = expandCalendarEvent(
    event({
      occurrenceOverrides: [{
        occurrenceKey: originalKey,
        status: 'CONFIRMED',
        deleted: false,
        startTime: '2026-10-22T12:00:00.000Z',
        endTime: '2026-10-22T13:30:00.000Z',
      }],
    }),
    new Date('2026-10-21T00:00:00.000Z'),
    new Date('2026-10-23T00:00:00.000Z'),
  );

  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].occurrenceKey, originalKey);
  assert.equal(occurrences[0].occurrenceDate, '2026-10-22');
  assert.equal(occurrences[0].start, '2026-10-22T12:00:00.000Z');
  assert.equal(occurrences[0].end, '2026-10-22T13:30:00.000Z');
});

test('omits occurrences deleted individually without shortening the recurring series', () => {
  const occurrences = expandCalendarEvent(
    event({
      occurrenceOverrides: [{
        occurrenceKey: 'instant:2026-10-12T10:00:00.000Z',
        status: 'CONFIRMED',
        deleted: true,
      }],
    }),
    new Date('2026-10-05T00:00:00.000Z'),
    new Date('2026-10-27T00:00:00.000Z'),
  );

  assert.deepEqual(occurrences.map(item => item.occurrenceDate), ['2026-10-05', '2026-10-19']);
});

test('clamps monthly recurrence at month end and returns to the anchor day', () => {
  const occurrences = expandCalendarEvent(
    event({
      startTime: '2026-01-31T10:00:00.000Z',
      endTime: '2026-01-31T11:00:00.000Z',
      recurrenceFrequency: 'MONTHLY',
      recurrenceEndDate: '2026-03-31',
    }),
    new Date('2026-01-01T00:00:00.000Z'),
    new Date('2026-04-01T00:00:00.000Z'),
  );

  assert.deepEqual(occurrences.map(item => item.occurrenceDate), [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
  ]);
});

test('treats an all-day end date as inclusive and its returned end as exclusive', () => {
  const [occurrence] = expandCalendarEvent(
    event({
      allDay: true,
      startDate: '2026-10-05',
      endDate: '2026-10-06',
      startTime: null,
      endTime: null,
      recurrenceFrequency: 'NONE',
      recurrenceEndDate: null,
    }),
    new Date('2026-10-05T00:00:00.000Z'),
    new Date('2026-10-07T00:00:00.000Z'),
  );

  assert.equal(occurrence.start, '2026-10-05');
  assert.equal(occurrence.end, '2026-10-07');
});
