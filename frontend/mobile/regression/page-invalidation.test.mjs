import assert from 'node:assert/strict';
import test from 'node:test';
import { pageInvalidationPrefixes } from '../src/lib/pageInvalidation.ts';

test('calendar feed changes refresh occurrences and calendars, while note autosaves preserve them', () => {
  assert.deepEqual(pageInvalidationPrefixes('/api/v1/calendar-sources/feed/sync'), ['calendar-sources', 'calendars', 'events']);
  assert.deepEqual(pageInvalidationPrefixes('/api/v1/notes/draft'), ['notes', 'note:']);
  assert.deepEqual(pageInvalidationPrefixes('/api/v1/notifications/id/acknowledge'), []);
});

test('task writes invalidate linked stat and mental-thread summaries', () => {
  assert.deepEqual(pageInvalidationPrefixes('/api/v1/tasks/task-id'), ['stats:', 'stat:', 'mental-threads']);
});
