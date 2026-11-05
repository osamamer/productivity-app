import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let userService;
let loadUserPreferences;
let getRuntimeUserPreferences;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const storage = new Map();

before(async () => {
  globalThis.window = {
    sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    localStorage: {
      getItem: () => null,
      removeItem: () => {},
    },
  };
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ userService } = await viteServer.ssrLoadModule('/src/services/api/userService.ts'));
  ({ loadUserPreferences } = await viteServer.ssrLoadModule('/src/services/bootstrap/appBootstrap.ts'));
  ({ getRuntimeUserPreferences } = await viteServer.ssrLoadModule('/src/services/userPreferenceStore.ts'));
});

after(async () => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  await viteServer?.close();
});

test('a cold preference load waits for the account accent and caches it', async () => {
  let resolveFetch;
  globalThis.fetch = () => new Promise(resolve => { resolveFetch = resolve; });
  assert.equal(userService.hydrateCachedPreferences(), false);

  const loading = loadUserPreferences();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(getRuntimeUserPreferences().accentColor, 'violet');
  resolveFetch(Response.json({ accentColor: 'coral', themeMode: 'dark' }));
  await loading;

  assert.equal(getRuntimeUserPreferences().accentColor, 'coral');
  assert.equal(userService.hydrateCachedPreferences(), true);
  assert.equal(JSON.parse(storage.get('claritard:anonymous:preferences')).preferences.accentColor, 'coral');
});

test('an uncached preference failure rejects the startup requirement', async () => {
  userService.clearPreferencesCache();
  globalThis.fetch = async () => new Response('Unavailable', { status: 400 });
  await assert.rejects(loadUserPreferences(), /Failed to load account preferences/);
});
