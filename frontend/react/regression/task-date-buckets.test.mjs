import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let splitTasksByDate;
let getHomeDisplayDate;
let dateKey;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ splitTasksByDate } = await viteServer.ssrLoadModule('/src/services/utils/taskDateBuckets.ts'));
  ({ getHomeDisplayDate } = await viteServer.ssrLoadModule('/src/services/utils/homeDay.ts'));
  ({ dateKey } = await viteServer.ssrLoadModule('/src/services/utils/taskDate.ts'));
});

after(async () => {
  await viteServer?.close();
});

test('Tasks keeps the previous date in Today until the configured day end', () => {
  const tasks = [
    { taskId: 'previous', scheduledPerformDateTime: '2026-11-16T22:00:00' },
    { taskId: 'calendar', scheduledPerformDateTime: '2026-11-17T02:00:00' },
    { taskId: 'older', scheduledPerformDateTime: '2026-11-15T12:00:00' },
  ];
  const earlyDay = dateKey(getHomeDisplayDate(new Date(2026, 10, 17, 2, 30), 4));
  const beforeEnd = splitTasksByDate(tasks, earlyDay);

  assert.deepEqual(beforeEnd.today.map(task => task.taskId), ['previous']);
  assert.deepEqual(beforeEnd.future.map(task => task.taskId), ['calendar']);
  assert.deepEqual(beforeEnd.past.map(task => task.taskId), ['older']);

  const afterEndDay = dateKey(getHomeDisplayDate(new Date(2026, 10, 17, 4, 0), 4));
  const afterEnd = splitTasksByDate(tasks, afterEndDay);
  assert.deepEqual(afterEnd.today.map(task => task.taskId), ['calendar']);
  assert.deepEqual(afterEnd.past.map(task => task.taskId), ['previous', 'older']);
});
