import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let mentalStateService;
let meditationService;
const originalFetch = globalThis.fetch;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ mentalStateService } = await viteServer.ssrLoadModule('/src/services/api/mentalStateService.ts'));
  ({ meditationService } = await viteServer.ssrLoadModule('/src/services/api/meditationService.ts'));
});

after(async () => {
  globalThis.fetch = originalFetch;
  await viteServer?.close();
});

test('mental-state writes update the cached history without another read', async () => {
  const first = { id: 'first', state: 'SETTLED', recordedAt: '2026-11-05T08:00:00Z' };
  const second = { id: 'second', state: 'READY', recordedAt: '2026-11-05T09:00:00Z' };
  let historyReads = 0;
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === 'POST') return Response.json(second);
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    historyReads += 1;
    return Response.json([first]);
  };

  assert.deepEqual(await mentalStateService.getHistory(40), [first]);
  await mentalStateService.checkIn({});
  assert.deepEqual(await mentalStateService.getHistory(40), [second, first]);
  await mentalStateService.deleteCheckIn('second');
  assert.deepEqual(await mentalStateService.getHistory(40), [first]);
  assert.equal(historyReads, 1);
});

test('a pending history read cannot cache the state from before a new check-in', async () => {
  const newCheckIn = { id: 'new', state: 'READY', recordedAt: '2026-11-05T10:00:00Z' };
  let resolveOldRead;
  let historyReads = 0;
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === 'POST') return Response.json(newCheckIn);
    historyReads += 1;
    return historyReads === 1
      ? new Promise(resolve => { resolveOldRead = resolve; })
      : Response.json([newCheckIn]);
  };

  const oldRead = mentalStateService.getHistory(30);
  await mentalStateService.checkIn({});
  resolveOldRead(Response.json([]));
  await oldRead;

  assert.equal(mentalStateService.getCachedHistory(30), undefined);
  assert.deepEqual(await mentalStateService.getHistory(30), [newCheckIn]);
  assert.equal(historyReads, 2);
});

test('meditation session changes update the cache and a live check can replace it', async () => {
  const active = { id: 'session-1', active: true, running: true, expiresAt: new Date(Date.now() + 60_000).toISOString() };
  const paused = { ...active, running: false };
  let activeReads = 0;
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === 'PATCH') return Response.json(paused);
    activeReads += 1;
    return activeReads === 1 ? Response.json(active) : new Response(null, { status: 204 });
  };

  assert.deepEqual(await meditationService.getActiveSession(), active);
  assert.deepEqual(await meditationService.pauseSession(active.id), paused);
  assert.deepEqual(await meditationService.getActiveSession(), paused);
  assert.equal(await meditationService.getActiveSession(true), null);
  assert.equal(await meditationService.getActiveSession(), null);
  assert.equal(activeReads, 2);
});
