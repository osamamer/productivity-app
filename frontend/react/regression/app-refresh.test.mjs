import assert from 'node:assert/strict';
import test from 'node:test';
import { subscribeToAppRefresh } from '../src/services/utils/appRefresh.ts';

test('kept snapshots refresh on mount, return from suspend and network recovery', async () => {
  const originals = Object.fromEntries(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalNow = Date.now;
  let now = 100_000;
  let pulse;
  let cleared = false;
  const win = Object.assign(new EventTarget(), { setInterval: callback => { pulse = callback; return 1; }, clearInterval: () => { cleared = true; } });
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const nav = { onLine: true };
  for (const [key, value] of Object.entries({ window: win, document: doc, navigator: nav })) Object.defineProperty(globalThis, key, { configurable: true, value });
  Date.now = () => now;
  let refreshes = 0;
  const stop = subscribeToAppRefresh(() => refreshes++);
  try {
    await Promise.resolve();
    assert.equal(refreshes, 1, 'validate the cached snapshot immediately');
    doc.visibilityState = 'hidden';
    now += 3_600_000;
    pulse();
    assert.equal(refreshes, 1);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('focus'));
    assert.equal(refreshes, 2, 'coalesce visibility and focus');
    now += 60_000;
    nav.onLine = false;
    pulse();
    assert.equal(refreshes, 2);
    nav.onLine = true;
    win.dispatchEvent(new Event('online'));
    assert.equal(refreshes, 3);
    now += 60_000;
    win.dispatchEvent(new Event('pageshow'));
    assert.equal(refreshes, 4);
    stop();
    assert.equal(cleared, true);
    now += 60_000;
    win.dispatchEvent(new Event('focus'));
    assert.equal(refreshes, 4);
  } finally {
    stop();
    Date.now = originalNow;
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
