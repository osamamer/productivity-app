import assert from 'node:assert/strict';
import test from 'node:test';
import {
  invalidateResource,
  subscribeToResourceInvalidation,
} from '../src/services/cache/resourceInvalidation.ts';

test('notifies only subscribers to the invalidated resource', () => {
  let taskNotifications = 0;
  let statNotifications = 0;
  const unsubscribeTasks = subscribeToResourceInvalidation('tasks', () => { taskNotifications += 1; });
  const unsubscribeStats = subscribeToResourceInvalidation('stats', () => { statNotifications += 1; });

  try {
    invalidateResource('tasks');
    assert.equal(taskNotifications, 1);
    assert.equal(statNotifications, 0);
  } finally {
    unsubscribeTasks();
    unsubscribeStats();
  }
});

test('stops notifying a listener after it unsubscribes', () => {
  let notifications = 0;
  const unsubscribe = subscribeToResourceInvalidation('projects', () => { notifications += 1; });

  unsubscribe();
  invalidateResource('projects');

  assert.equal(notifications, 0);
});
