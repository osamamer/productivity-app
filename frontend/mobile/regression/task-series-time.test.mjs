import assert from 'node:assert/strict';
import test from 'node:test';
import { taskSeriesTimeUpdate } from '../src/lib/taskSeriesTime.ts';

test('series time edits preserve the anchor date, custom weekdays, end date and subtask policy', () => {
  const series = {
    startDateTime: '2025-07-03T08:00:00', recurrenceFrequency: 'CUSTOM', recurrenceEndDate: '2027-01-31',
    recurrenceInterval: 2, recurrenceUnit: 'WEEKS', recurrenceDaysOfWeek: ['MONDAY', 'THURSDAY'],
    timeZone: 'Asia/Amman', repeatSubtasks: true, active: true,
  };
  assert.deepEqual(taskSeriesTimeUpdate(series, '2026-11-27T15:45:00'), {
    ...series, startDateTime: '2025-07-03T15:45:00',
  });
  assert.equal(series.startDateTime, '2025-07-03T08:00:00');
});
