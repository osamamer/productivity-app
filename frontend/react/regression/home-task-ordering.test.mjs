import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let compareHomeTasks;
let compareHomeTaskListItems;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ compareHomeTasks, compareHomeTaskListItems } = await viteServer.ssrLoadModule('/src/services/utils/homeTaskOrdering.ts'));
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

test('moves a group below active Home rows when its last task is completed', () => {
  const group = { kind: 'group', tasks: [{ completed: true }, { completed: false }] };
  const rows = [
    { id: 'group', item: group, anchorIndex: 0, index: 0 },
    { id: 'active', item: { kind: 'task', task: { completed: false } }, anchorIndex: 1, index: 1 },
    { id: 'done', item: { kind: 'task', task: { completed: true } }, anchorIndex: 2, index: 2 },
  ];

  assert.deepEqual(rows.toSorted(compareHomeTaskListItems).map(row => row.id), ['group', 'active', 'done']);
  group.tasks[1].completed = true;
  assert.deepEqual(rows.toSorted(compareHomeTaskListItems).map(row => row.id), ['active', 'group', 'done']);
});
