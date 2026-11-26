import assert from 'node:assert/strict';
import test from 'node:test';
import { isNormalCalendarEvent } from '../../shared/calendarEventKind.ts';

test('Today keeps normal and imported events while excluding activity chunks and task focus blocks', () => {
  const events = [
    { id: 'ordinary' },
    { id: 'imported', sourceId: 'feed', activityId: null, taskId: null },
    { id: 'activity', activityId: 'reading' },
    { id: 'task', taskId: 'work' },
    { id: 'both', activityId: 'reading', taskId: 'work' },
  ];
  assert.deepEqual(events.filter(isNormalCalendarEvent).map(event => event.id), ['ordinary', 'imported']);
});
