import assert from 'node:assert/strict';
import test from 'node:test';
import {
  datesCoveredByOccurrence,
  expandCalendarEvent,
} from '../src/lib/calendarRecurrence.ts';

function timedWeeklyEvent(overrides = {}) {
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

test('expands weekly events through the inclusive recurrence end and keeps individual cancellation status', () => {
  const event = timedWeeklyEvent({
    cancelledOccurrenceKeys: ['instant:2026-10-12T13:00:00+03:00'],
  });

  const occurrences = expandCalendarEvent(
    event,
    new Date('2026-10-05T00:00:00.000Z'),
    new Date('2026-10-27T00:00:00.000Z'),
  );

  assert.deepEqual(occurrences.map(occurrence => occurrence.occurrenceDate), [
    '2026-10-05',
    '2026-10-12',
    '2026-10-19',
  ]);
  assert.deepEqual(occurrences.map(occurrence => occurrence.status), [
    'CONFIRMED',
    'CANCELLED',
    'CONFIRMED',
  ]);
});

test('expands custom two-week recurrences without exceeding their end date', () => {
  const occurrences = expandCalendarEvent(
    timedWeeklyEvent({
      recurrenceFrequency: 'CUSTOM',
      recurrenceInterval: 2,
      recurrenceUnit: 'WEEKS',
      recurrenceEndDate: '2026-10-31',
    }),
    new Date('2026-10-01T00:00:00.000Z'),
    new Date('2026-11-05T00:00:00.000Z'),
  );

  assert.deepEqual(occurrences.map(occurrence => occurrence.occurrenceDate), [
    '2026-10-05',
    '2026-10-19',
  ]);
});

test('includes a moved occurrence in its new visible range while preserving its original occurrence key', () => {
  const originalKey = 'instant:2026-10-12T10:00:00.000Z';
  const event = timedWeeklyEvent({
    occurrenceOverrides: [{
      occurrenceKey: originalKey,
      status: 'CONFIRMED',
      deleted: false,
      startTime: '2026-10-22T12:00:00.000Z',
      endTime: '2026-10-22T13:30:00.000Z',
    }],
  });

  const occurrences = expandCalendarEvent(
    event,
    new Date('2026-10-21T00:00:00.000Z'),
    new Date('2026-10-23T00:00:00.000Z'),
  );

  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].occurrenceKey, originalKey);
  assert.equal(occurrences[0].occurrenceDate, '2026-10-22');
  assert.equal(occurrences[0].start, '2026-10-22T12:00:00.000Z');
  assert.equal(occurrences[0].end, '2026-10-22T13:30:00.000Z');
});

test('treats all-day event end dates as inclusive when listing covered days', () => {
  const event = timedWeeklyEvent({
    allDay: true,
    startDate: '2026-10-05',
    endDate: '2026-10-06',
    startTime: null,
    endTime: null,
    recurrenceFrequency: 'NONE',
    recurrenceEndDate: null,
  });

  const [occurrence] = expandCalendarEvent(
    event,
    new Date('2026-10-05T00:00:00.000Z'),
    new Date('2026-10-07T00:00:00.000Z'),
  );

  assert.deepEqual(datesCoveredByOccurrence(occurrence), ['2026-10-05', '2026-10-06']);
});

test('hides a deleted occurrence while keeping later occurrences in the series', () => {
  const occurrences = expandCalendarEvent(
    timedWeeklyEvent({
      occurrenceOverrides: [{
        occurrenceKey: 'instant:2026-10-12T10:00:00.000Z',
        status: 'CONFIRMED',
        deleted: true,
      }],
    }),
    new Date('2026-10-05T00:00:00.000Z'),
    new Date('2026-10-27T00:00:00.000Z'),
  );

  assert.deepEqual(occurrences.map(occurrence => occurrence.occurrenceDate), [
    '2026-10-05',
    '2026-10-19',
  ]);
});
