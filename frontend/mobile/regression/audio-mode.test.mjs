import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const [, audioOptions] = config.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'react-native-audio-api');

test('native meditation audio continues through the Android media playback service', () => {
  assert.equal(audioOptions.androidForegroundService, true);
  assert.ok(audioOptions.androidFSTypes.includes('mediaPlayback'));
  assert.ok(audioOptions.androidPermissions.includes('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'));
});

test('native meditation audio is allowed in the iOS background', () => {
  assert.equal(audioOptions.iosBackgroundMode, true);
});
