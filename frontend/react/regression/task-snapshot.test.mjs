import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let reconcileTaskSnapshot;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ reconcileTaskSnapshot } = await viteServer.ssrLoadModule('/src/services/utils/taskSnapshot.ts'));
});

after(async () => {
  await viteServer?.close();
});

test('keeps existing references when a forced refresh returns unchanged tasks', () => {
  const existing = [{ taskId: 'one', name: 'Plan', focusHistory: { seconds: 30 } }];
  const refreshed = [{ taskId: 'one', name: 'Plan', focusHistory: { seconds: 30 } }];

  assert.equal(reconcileTaskSnapshot(existing, refreshed), existing);
});

test('returns changed task data while reusing unchanged records', () => {
  const first = { taskId: 'one', name: 'Plan' };
  const second = { taskId: 'two', name: 'Draft' };
  const previous = [first, second];
  const reconciled = reconcileTaskSnapshot(
    previous,
    [{ taskId: 'one', name: 'Replan' }, { taskId: 'two', name: 'Draft' }],
  );

  assert.notEqual(reconciled, previous);
  assert.equal(reconciled[0].name, 'Replan');
  assert.equal(reconciled[1], second);
});

test('recognizes server-side task reordering as a snapshot change', () => {
  const first = { taskId: 'one', name: 'Plan' };
  const second = { taskId: 'two', name: 'Draft' };
  const reordered = reconcileTaskSnapshot(
    [first, second],
    [{ taskId: 'two', name: 'Draft' }, { taskId: 'one', name: 'Plan' }],
  );

  assert.deepEqual(reordered.map(task => task.taskId), ['two', 'one']);
  assert.equal(reordered[0], second);
  assert.equal(reordered[1], first);
});
