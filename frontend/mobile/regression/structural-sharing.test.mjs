import assert from 'node:assert/strict';
import test from 'node:test';
import { keepUnchanged } from '../../shared/keepUnchanged.ts';

test('server reconciliation preserves unchanged task rows across refreshes and reordering', () => {
  const tasks = [{ taskId: 'first', completed: false }, { taskId: 'second', completed: false }];
  assert.equal(keepUnchanged(tasks, structuredClone(tasks)), tasks);
  const reordered = keepUnchanged(tasks, [{ taskId: 'second', completed: true }, { taskId: 'first', completed: false }]);
  assert.equal(reordered[1], tasks[0]);
  assert.notEqual(reordered[0], tasks[1]);
});
