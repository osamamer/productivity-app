import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeAppPause,
  describeSiteTimer,
  displayUrl,
  formatDuration,
  parseWholeNumber,
} from '../src/components/boundaries/boundaryText.ts';

test('durations read in the largest sensible unit', () => {
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(1800), '30 min');
  assert.equal(formatDuration(3600), '1 h');
  assert.equal(formatDuration(5400), '1 h 30 min');
});

test('an app list entry says how long the pause is and when the app closes', () => {
  assert.equal(describeAppPause(null), 'No pause');
  assert.equal(describeAppPause({ delaySeconds: 30, closeAfterSeconds: 0, autoOpen: true, message: '' }), '30 s pause');
  assert.equal(describeAppPause({ delaySeconds: 60, closeAfterSeconds: 1800, autoOpen: true, message: '' }), '1 min pause · closes after 30 min');
});

test('a site timer says Firefox closes, because the whole browser is timed', () => {
  assert.equal(describeSiteTimer({ delaySeconds: 30, closeAfterSeconds: 900 }), '30 s pause · Firefox closes after 15 min');
});

test('stored URLs are shown the way the user typed them', () => {
  assert.equal(displayUrl('https://www.youtube.com/'), 'www.youtube.com');
  assert.equal(displayUrl('https://youtube.com/shorts'), 'youtube.com/shorts');
});

test('number fields accept whole numbers inside their range only', () => {
  assert.equal(parseWholeNumber('30', 0, 86400), 30);
  assert.equal(parseWholeNumber('', 0, 86400), null);
  assert.equal(parseWholeNumber('1.5', 0, 86400), null);
  assert.equal(parseWholeNumber('0', 1, 1440), null);
});
