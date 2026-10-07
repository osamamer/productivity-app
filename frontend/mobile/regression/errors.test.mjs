import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONNECTION_ERROR_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  SIGN_IN_UNAVAILABLE_MESSAGE,
  reportError,
  signInResponseMessage,
} from '../src/lib/errors.ts';

test('maps invalid credentials to a concise sign-in message', () => {
  assert.equal(signInResponseMessage('INVALID_GRANT'), INVALID_CREDENTIALS_MESSAGE);
  assert.equal(signInResponseMessage(undefined, 'Invalid user credentials'), INVALID_CREDENTIALS_MESSAGE);
});

test('maps unavailable sign-in configuration and unknown failures to safe messages', () => {
  assert.equal(signInResponseMessage('invalid_client'), SIGN_IN_UNAVAILABLE_MESSAGE);
  assert.equal(signInResponseMessage(undefined, 'direct access grants disabled'), SIGN_IN_UNAVAILABLE_MESSAGE);
  assert.equal(signInResponseMessage('unknown', 'https://private-auth.example/raw'), GENERIC_ERROR_MESSAGE);
  assert.equal(CONNECTION_ERROR_MESSAGE.includes('internet connection'), true);
});

test('logs the developer error while returning only the generic user message', () => {
  const originalError = console.error;
  const cause = new Error('private implementation detail');
  let logged;
  console.error = (...args) => { logged = args; };

  try {
    assert.equal(reportError('Loading tasks', cause), GENERIC_ERROR_MESSAGE);
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(logged, ['Loading tasks:', cause]);
});
