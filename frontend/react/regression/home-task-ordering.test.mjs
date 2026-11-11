import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let compareHomeTasks;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ compareHomeTasks } = await viteServer.ssrLoadModule('/src/services/utils/homeTaskOrdering.ts'));
});

after(async () => {
  await viteServer?.close();
});

test('keeps the saved task order when schedule and importance differ', () => {
  const tasks = [
    { taskId: 'manually-first', completed: false, scheduledPerformDateTime: '2026-11-12T16:00:00', importance: 1 },
    { taskId: 'manually-second', completed: false, scheduledPerformDateTime: '2026-11-12T09:00:00', importance: 10 },
  ];

  assert.deepEqual(tasks.toSorted(compareHomeTasks).map(task => task.taskId), [
    'manually-first',
    'manually-second',
  ]);
});

test('keeps incomplete tasks before completed tasks without reordering either group', () => {
  const tasks = [
    { taskId: 'open-second', completed: false, importance: 0 },
    { taskId: 'done-first', completed: true, importance: 10 },
    { taskId: 'open-first', completed: false, importance: 10 },
    { taskId: 'done-second', completed: true, importance: 0 },
  ];

  assert.deepEqual(tasks.toSorted(compareHomeTasks).map(task => task.taskId), [
    'open-second',
    'open-first',
    'done-first',
    'done-second',
  ]);
});
