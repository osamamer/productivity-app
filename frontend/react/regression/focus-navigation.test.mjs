import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let isFocusNavigationLocked;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ isFocusNavigationLocked } = await viteServer.ssrLoadModule('/src/services/utils/focusNavigation.ts'));
});

after(async () => {
  await viteServer?.close();
});

function status(overrides = {}) {
  return {
    active: true,
    sessionActive: true,
    sessionRunning: true,
    phase: 'FOCUS',
    ...overrides,
  };
}

test('locks navigation throughout a focus phase, including when it is paused', () => {
  assert.equal(isFocusNavigationLocked(status()), true);
  assert.equal(isFocusNavigationLocked(status({ sessionRunning: false })), true);
});

test('allows navigation during breaks and when no focus session is active', () => {
  assert.equal(isFocusNavigationLocked(status({ phase: 'BREAK' })), false);
  assert.equal(isFocusNavigationLocked(status({ phase: 'WAITING_FOR_BREAK' })), false);
  assert.equal(isFocusNavigationLocked(status({ sessionActive: false })), false);
  assert.equal(isFocusNavigationLocked(status({ active: false })), false);
  assert.equal(isFocusNavigationLocked(null), false);
});

test('supports older active focus status without a phase field, including paused sessions', () => {
  assert.equal(isFocusNavigationLocked(status({ phase: undefined })), true);
    assert.equal(isFocusNavigationLocked(status({ phase: undefined, sessionRunning: false })), true);
});
