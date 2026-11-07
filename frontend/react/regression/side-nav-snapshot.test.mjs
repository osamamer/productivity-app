import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let sideNavSnapshotCache;
const originalFetch = globalThis.fetch;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ sideNavSnapshotCache } = await viteServer.ssrLoadModule('/src/services/cache/sideNavSnapshotCache.ts'));
});

after(async () => {
  globalThis.fetch = originalFetch;
  sideNavSnapshotCache?.clear();
  await viteServer?.close();
});

test('loads mental-state data with the drawer task and focus summary', async () => {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const recordedAt = new Date().toISOString();

  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('/api/v1/tasks/today')) {
      return Response.json([{
        taskId: 'today-task',
        completed: false,
        skipped: false,
        scheduledPerformDateTime: `${today}T09:00:00`,
      }]);
    }
    if (url.includes('/api/v1/tasks/focus-today')) {
      return Response.json({ date: today, totalFocusSeconds: 3600 });
    }
    if (url.includes('/api/v1/mental-state/check-ins')) {
      return Response.json([{ id: 'check-in', state: 'Ready', recordedAt }]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  assert.deepEqual(await sideNavSnapshotCache.get(), {
    openTaskCount: 1,
    focusSeconds: 3600,
    mentalState: 'Ready',
  });
});
