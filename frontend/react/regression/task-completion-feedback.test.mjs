import assert from 'node:assert/strict';
import test from 'node:test';
import { taskCompletionFeedbackKind } from '../src/services/utils/taskCompletionFeedback.ts';

const today = new Date(2026, 10, 4, 12);
const task = (taskId, completed = false, scheduledPerformDateTime = '2026-11-04T09:00:00') => ({
  taskId,
  completed,
  scheduledPerformDateTime,
  parentId: '',
  skipped: false,
});

test('plays the Pomodoro completion cue only when the final task for today is completed', () => {
  const tasks = [task('done', true), task('final')];
  assert.equal(taskCompletionFeedbackKind(tasks, new Set(['final']), today), 'pomodoroCompleted');
  assert.equal(taskCompletionFeedbackKind(tasks, new Set(['done']), today), 'taskCompleted');
});

test('handles a bulk completion of the remaining tasks without counting other dates', () => {
  const tasks = [task('morning'), task('afternoon'), task('tomorrow', false, '2026-11-05T09:00:00')];
  assert.equal(taskCompletionFeedbackKind(tasks, new Set(['morning', 'afternoon']), today), 'pomodoroCompleted');
  assert.equal(taskCompletionFeedbackKind(tasks, new Set(['morning']), today), 'taskCompleted');
  assert.equal(taskCompletionFeedbackKind(tasks, new Set(['tomorrow']), today), 'taskCompleted');
});

test('does not count subtasks as independent tasks for day completion', () => {
  const subtask = { ...task('child'), parentId: 'parent' };
  assert.equal(taskCompletionFeedbackKind([task('parent'), subtask], new Set(['parent']), today), 'pomodoroCompleted');
});

test('does not play the day completion cue when reopening or repeating a completed task', () => {
  const tasks = [task('already-done', true)];
  assert.equal(taskCompletionFeedbackKind(tasks, new Set(), today), 'taskCompleted');
  assert.equal(taskCompletionFeedbackKind(tasks, new Set(['already-done']), today), 'taskCompleted');
});
