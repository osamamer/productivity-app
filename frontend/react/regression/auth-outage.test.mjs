import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

// Reproduces the 2026-11-16 outage: with its database down, Keycloak answered every token
// request with HTTP 400 `unauthorized_client`. The app treated that as a rejected session,
// signed the user out on reload, and told them their correct password was wrong.

let viteServer;
let auth;
let failures;
let tokenRefresh;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const storage = new Map();
const sessionValues = new Map();

const inMemory = values => ({
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
});
const memoryStorage = inMemory(storage);
const sessionMemoryStorage = inMemory(sessionValues);

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
    sessionStorage: sessionMemoryStorage,
    location: { pathname: '/', replace: () => {} },
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: handle => clearTimeout(handle),
  };
  globalThis.localStorage = memoryStorage;
  globalThis.sessionStorage = sessionMemoryStorage;
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  auth = await viteServer.ssrLoadModule('/src/services/keycloak.ts');
  failures = await viteServer.ssrLoadModule('/src/services/auth/authFailures.ts');
  tokenRefresh = await viteServer.ssrLoadModule('/src/services/auth/tokenRefresh.ts');
});

beforeEach(() => {
  storage.clear();
  sessionValues.clear();
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
  assert.equal(auth.default.refreshToken, refreshToken, 'the session survives the outage');
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

test('a successful refresh replaces and saves the session', async () => {
  const freshAccessToken = jwt({ sub: 'user-1', iat: nowSeconds(), exp: nowSeconds() + 300 });
  const freshRefreshToken = jwt({ sub: 'user-1', typ: 'Refresh', exp: nowSeconds() + 90_000 });
  respondWith(200, { access_token: freshAccessToken, refresh_token: freshRefreshToken });

  assert.equal(await auth.refreshAuthToken(30), true);

  assert.equal(auth.default.token, freshAccessToken);
  assert.equal(auth.default.refreshToken, freshRefreshToken);
  assert.equal(auth.default.isTokenExpired(30), false);
  assert.equal(JSON.parse(storage.get(auth.AUTH_SESSION_STORAGE_KEY)).token, freshAccessToken);
});

test('a token request on a dead connection gives up instead of hanging', async () => {
  // A dropped connection never answers; only the abort signal can end the request. Node does
  // not keep the process alive for AbortSignal.timeout, so the fake connection does.
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    const openConnection = setTimeout(() => {}, 60_000);
    init.signal.addEventListener('abort', () => {
      clearTimeout(openConnection);
      reject(init.signal.reason);
    });
  });

  await assert.rejects(
    tokenRefresh.requestTokenRefresh('https://auth.test/token', refreshToken, 'app', 20),
    { name: 'TimeoutError' },
  );
});
