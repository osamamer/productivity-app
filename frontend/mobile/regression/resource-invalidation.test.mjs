import assert from 'node:assert/strict';
import test from 'node:test';
import {
  invalidateResource,
  subscribeToResourceInvalidation,
} from '../src/lib/resourceInvalidation.ts';

test('notifies only listeners for the invalidated resource', () => {
  let taskCalls = 0;
  let statCalls = 0;
  const unsubscribeTasks = subscribeToResourceInvalidation('tasks', () => { taskCalls += 1; });
  const unsubscribeStats = subscribeToResourceInvalidation('stats', () => { statCalls += 1; });

  try {
    invalidateResource('tasks');
    assert.equal(taskCalls, 1);
    assert.equal(statCalls, 0);
  } finally {
    unsubscribeTasks();
    unsubscribeStats();
  }
});

test('does not notify a listener after unsubscribe', () => {
  let calls = 0;
  const unsubscribe = subscribeToResourceInvalidation('stats', () => { calls += 1; });
  unsubscribe();

  invalidateResource('stats');

  assert.equal(calls, 0);
});
