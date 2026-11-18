import assert from 'node:assert/strict';
import test from 'node:test';
import { todayChunks } from '../src/components/leisure/todayChunks.ts';

const event = (id, startTime, endTime, extra = {}) => ({
  id, title: id, startTime, endTime, allDay: false, status: 'CONFIRMED', recurrenceFrequency: 'NONE',
  activityId: null, occurrenceOverrides: [], cancelledOccurrenceKeys: [], ...extra,
});
const overview = events => ({ dayStart: '2026-11-18T00:00:00', dayEnd: '2026-11-19T00:00:00', events });

test("one-off events on other days are not part of today's plan", () => {
  const chunks = todayChunks(overview([
    event('today', '2026-11-18T22:30:00Z', '2026-11-18T23:30:00Z'),
    event('yesterday', '2026-11-17T11:30:00Z', '2026-11-17T12:00:00Z'),
    event('tomorrow', '2026-11-19T11:30:00Z', '2026-11-19T12:00:00Z'),
  ]));
  assert.deepEqual(chunks.map(chunk => chunk.id), ['today']);
});

test('an event running across midnight into today still counts', () => {
  const chunks = todayChunks(overview([event('late', '2026-11-17T23:00:00Z', '2026-11-18T01:00:00Z')]));
  assert.deepEqual(chunks.map(chunk => chunk.id), ['late']);
});

test('a daily event appears once, on today', () => {
  const chunks = todayChunks(overview([
    event('scrum', '2026-11-02T11:30:00Z', '2026-11-02T12:00:00Z', { recurrenceFrequency: 'DAILY', recurrenceEndDate: null }),
  ]));
  assert.equal(chunks.length, 1);
  assert.equal(new Date(chunks[0].start).toISOString(), '2026-11-18T11:30:00.000Z');
});
