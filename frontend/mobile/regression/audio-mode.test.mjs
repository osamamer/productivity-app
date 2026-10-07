import assert from 'node:assert/strict';
import test from 'node:test';
import { configureBackgroundAudio } from '../src/lib/audioMode.ts';

test('enables silent-mode playback and background audio with the selected interruption mode', async () => {
  let configuredMode;
  await configureBackgroundAudio({
    setAudioModeAsync: async mode => { configuredMode = mode; },
  }, 'meditation', 'duckOthers');

  assert.deepEqual(configuredMode, {
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'duckOthers',
  });
});

test('does not throw when background audio is unavailable or configuration fails', async () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  const logged = [];
  console.warn = (...args) => { logged.push(args); };
  console.error = (...args) => { logged.push(args); };

  try {
    await configureBackgroundAudio({}, 'pomodoro');
    const failure = new Error('native audio unavailable');
    await configureBackgroundAudio({ setAudioModeAsync: async () => { throw failure; } }, 'pomodoro');
    assert.equal(logged[0][0], 'pomodoro audio mode is unavailable in this native build.');
    assert.deepEqual(logged[1], ['Could not configure pomodoro audio:', failure]);
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
});
