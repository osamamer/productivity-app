import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarDateParts,
  clock,
  eventDateInTimeZone,
  greeting,
  localDate,
  localDateTime,
  localDateTimeToInstant,
  secondsFromDuration,
} from '../src/lib/date.ts';

test('formats device-local dates and local date-times consistently', () => {
  const date = new Date('2026-10-07T09:05:00.000Z');

  assert.equal(localDate(date), '2026-10-07');
  assert.equal(localDateTime(date), '2026-10-07T09:05:00');
});

test('keeps event dates in the requested time zone across midnight', () => {
  const instant = '2026-01-01T03:30:00.000Z';

  assert.equal(eventDateInTimeZone(instant, 'America/Los_Angeles'), '2025-12-31');
  assert.equal(eventDateInTimeZone('2026-01-01', 'America/Los_Angeles'), '2026-01-01');
});

test('returns calendar parts for the event time zone and preserves date-only values', () => {
  const instant = '2026-01-01T03:30:00.000Z';
  const localParts = calendarDateParts(instant, 'America/Los_Angeles');
  const utcParts = calendarDateParts(instant, 'UTC');

  assert.equal(localParts.day, '31');
  assert.equal(utcParts.day, '1');
  assert.equal(calendarDateParts('2026-01-01').day, '1');
  assert.equal(calendarDateParts(null), null);
  assert.equal(calendarDateParts('not-a-date'), null);
});

test('converts valid local date and time fields into an instant and rejects invalid fields', () => {
  assert.equal(localDateTimeToInstant('2026-10-07', '09:05'), '2026-10-07T09:05:00.000Z');
  assert.equal(localDateTimeToInstant('2026-02-30', '09:05'), null);
  assert.equal(localDateTimeToInstant('2026-10-07', '25:00'), null);
});

test('selects greetings from the supplied local hour', () => {
  assert.equal(greeting(new Date('2026-10-07T11:59:00.000Z')), 'Good morning');
  assert.equal(greeting(new Date('2026-10-07T12:00:00.000Z')), 'Good afternoon');
  assert.equal(greeting(new Date('2026-10-07T18:00:00.000Z')), 'Good evening');
});

test('converts backend durations to seconds from numeric, day-tuple, and ISO values', () => {
  assert.equal(secondsFromDuration(90), 90);
  assert.equal(secondsFromDuration([1, 3_600]), 90_000);
  assert.equal(secondsFromDuration('1H2M3.5S'), 3_723.5);
  assert.equal(secondsFromDuration(null), 0);
  assert.equal(secondsFromDuration(''), 0);
});

test('formats timer seconds as minutes and seconds and clamps negative values', () => {
  assert.equal(clock(61.9), '01:01');
  assert.equal(clock(3_661), '61:01');
  assert.equal(clock(-5), '00:00');
});
