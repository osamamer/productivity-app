import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

// Reproduces the 2026-11-16 outage: with its database down, Keycloak answered every token
// request with HTTP 400 `unauthorized_client`. The app treated that as a rejected session,
// signed the user out on reload, and told them their correct password was wrong.

let viteServer;
let auth;
let failures;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const storage = new Map();

const memoryStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};

function jwt(payload) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
const expiredAccessToken = jwt({ sub: 'user-1', iat: nowSeconds() - 600, exp: nowSeconds() - 300 });
const refreshToken = jwt({ sub: 'user-1', typ: 'Refresh', exp: nowSeconds() + 86_400 });

function respondWith(status, body) {
  globalThis.fetch = async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const outage = () => respondWith(400, {
  error: 'unauthorized_client',
  description: 'Unexpected error when authenticating client',
});
const rejected = () => respondWith(400, { error: 'invalid_grant', error_description: 'Token is not active' });

before(async () => {
  globalThis.window = {
    localStorage: memoryStorage,
    sessionStorage: memoryStorage,
    location: { pathname: '/', replace: () => {} },
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: handle => clearTimeout(handle),
  };
  globalThis.localStorage = memoryStorage;
  globalThis.sessionStorage = memoryStorage;
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  auth = await viteServer.ssrLoadModule('/src/services/keycloak.ts');
  failures = await viteServer.ssrLoadModule('/src/services/auth/authFailures.ts');
  // keycloak-js derives its endpoints during init(); give it the realm endpoints directly.
  auth.default.endpoints = { token: () => 'https://auth.test/realms/app/protocol/openid-connect/token' };
});

beforeEach(() => {
  storage.clear();
  auth.restoreAuthSession({ token: expiredAccessToken, refreshToken });
  auth.default.timeSkew = 0;
});

after(async () => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  await viteServer?.close();
});

test('only invalid_grant counts as Keycloak rejecting the credentials', async () => {
  const response = (status, body) => new Response(JSON.stringify(body), { status });

  assert.equal(await failures.isInvalidGrantResponse(response(401, { error: 'invalid_grant' })), true);
  assert.equal(await failures.isInvalidGrantResponse(response(400, { error: 'invalid_grant' })), true);
  assert.equal(await failures.isInvalidGrantResponse(response(400, { error: 'unauthorized_client' })), false);
  assert.equal(await failures.isInvalidGrantResponse(response(502, { error: 'invalid_grant' })), false);
  assert.equal(await failures.isInvalidGrantResponse(new Response('<html>Bad gateway</html>', { status: 400 })), false);
});

test('a refresh during an identity-server outage keeps the session for a later retry', async () => {
  outage();

  const error = await auth.refreshAuthToken(30).then(() => null, caught => caught);

  assert.ok(error, 'the refresh still reports the failure');
  assert.equal(auth.isDefinitiveRefreshFailure(error), false);
  assert.equal(auth.default.refreshToken, refreshToken, 'keycloak-js cleared the token; it must be restored');
  assert.equal(auth.default.authenticated, true);
});

test('a refresh token Keycloak rejects is a definitive sign-out', async () => {
  rejected();

  const error = await auth.refreshAuthToken(30).then(() => null, caught => caught);

  assert.ok(error instanceof auth.SessionRejectedError);
  assert.equal(auth.isDefinitiveRefreshFailure(error), true);
});

test('sign-in reports wrong credentials only when Keycloak rejects them', async () => {
  respondWith(401, { error: 'invalid_grant', error_description: 'Invalid user credentials' });
  await assert.rejects(auth.authenticateWithPassword('me', 'wrong'), { message: auth.SIGN_IN_REJECTED });

  outage();
  await assert.rejects(auth.authenticateWithPassword('me', 'right'), { message: auth.SIGN_IN_UNAVAILABLE });

  respondWith(502, {});
  await assert.rejects(auth.authenticateWithPassword('me', 'right'), { message: auth.SIGN_IN_UNAVAILABLE });

  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(auth.authenticateWithPassword('me', 'right'), { message: auth.SIGN_IN_UNAVAILABLE });
});
