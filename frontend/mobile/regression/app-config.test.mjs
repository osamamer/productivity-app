import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const appConfig = createRequire(import.meta.url)('../app.config.js');

test('APK build codes update Android metadata while preserving app-version runtime compatibility', () => {
  const previousCode = process.env.ANDROID_VERSION_CODE;
  const previousEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
  try {
    process.env.ANDROID_VERSION_CODE = '387';
    process.env.EXPO_PUBLIC_APP_ENV = 'development';
    const result = appConfig({ config: { version: '1.2.0', android: {}, extra: {} } });
    assert.equal(result.version, '1.2.0');
    assert.equal(result.android.versionCode, 387);
    assert.equal(result.extra.buildNumber, '387');
    delete process.env.ANDROID_VERSION_CODE;
    assert.equal(appConfig({ config: { version: '1.2.0' } }).version, '1.2.0');
  } finally {
    if (previousCode === undefined) delete process.env.ANDROID_VERSION_CODE;
    else process.env.ANDROID_VERSION_CODE = previousCode;
    if (previousEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = previousEnvironment;
  }
});
