import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let eventService;
const storage = new Map();
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

before(async () => {
  globalThis.window = {
    sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  };
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ eventService } = await viteServer.ssrLoadModule('/src/services/api/eventService.ts'));
});

after(async () => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  await viteServer?.close();
});

test('an event created from Home is present in the Calendar session snapshot', async () => {
  const existing = { id: 'existing', title: 'Planning' };
  const created = { id: 'created', title: 'Break' };
  globalThis.fetch = async (_url, init = {}) => new Response(
    JSON.stringify(init.method === 'POST' ? created : [existing]),
    { status: init.method === 'POST' ? 201 : 200 },
  );

  assert.deepEqual(await eventService.getEvents(), [existing]);
  assert.deepEqual(await eventService.createEvent({ title: 'Break' }), created);
  assert.deepEqual(eventService.getLastKnownEvents(), [existing, created]);

  const snapshot = JSON.parse(storage.get('claritard:anonymous:events'));
  assert.deepEqual(snapshot.events, [existing, created]);
});
