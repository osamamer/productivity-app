import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

const RealDate = Date;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const storage = new Map();
const sessionStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
let viteServer;
let taskService;
let applyUserPreferences;

before(async () => {
  globalThis.window = { sessionStorage, localStorage: sessionStorage };
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ taskService } = await viteServer.ssrLoadModule('/src/services/api/taskService.ts'));
  ({ applyUserPreferences } = await viteServer.ssrLoadModule('/src/services/userPreferenceStore.ts'));
});

after(async () => {
  globalThis.Date = RealDate;
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  await viteServer?.close();
});

test('Tasks fetches every display-day task after midnight, even beyond paged past tasks', async () => {
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [new RealDate(2026, 10, 17, 2, 30)])); }
  };
  applyUserPreferences('task-page-day-test', { homeDayEndHour: 4 });
  const requests = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    requests.push(url.search);
    let ids = [];
    if (url.searchParams.get('date') === '2026-11-16') ids = ['yesterday-1', 'yesterday-2'];
    if (url.searchParams.get('date') === '2026-11-17') ids = ['calendar-today'];
    if (url.searchParams.get('period') === 'PAST') ids = ['yesterday-1'];
    if (url.searchParams.get('period') === 'FUTURE') ids = ['calendar-today'];
    return new Response(JSON.stringify(ids.map(taskId => ({
      task: { taskId, scheduledPerformDateTime: taskId.startsWith('yesterday')
        ? '2026-11-16T12:00:00' : '2026-11-17T12:00:00' },
      focusHistory: {},
    }))), { headers: { 'Content-Type': 'application/json' } });
  };

  const snapshot = await taskService.getTaskPageInitialSnapshot(1, undefined, true);
  assert.deepEqual(snapshot.tasks.map(task => task.taskId), ['yesterday-1', 'yesterday-2', 'calendar-today']);
  assert.ok(requests.includes('?date=2026-11-16'));
  assert.ok(requests.includes('?date=2026-11-17'));
});
