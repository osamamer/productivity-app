const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTimeoutCommand, selfCommand } = require('../src/timeouts/cli');

test('a normal launch is not a timeout command', () => {
    assert.equal(parseTimeoutCommand(['/opt/Claritard/claritard']), null);
});

test('a delayed launcher passes its desktop ID, action and URIs', () => {
    const argv = ['/opt/Claritard/claritard', '--timeout-launch=spotify.desktop', '--timeout-action=NewWindow', '--', 'spotify:track:1'];
    assert.deepEqual(parseTimeoutCommand(argv), { type: 'launch', appId: 'spotify.desktop', action: 'NewWindow', uris: ['spotify:track:1'] });
});

test('switches Chromium appends to a forwarded command line are not taken as URIs', () => {
    const argv = ['claritard', '--timeout-launch=a.desktop', '--', '--allow-file-access-from-files'];
    assert.deepEqual(parseTimeoutCommand(argv).uris, []);
});

test('run delays any command, opening it automatically unless confirmation is asked for', () => {
    const parsed = parseTimeoutCommand(['claritard', '--timeout-run', '--timeout-seconds=10', '--timeout-confirm', '--', 'firefox', '--private-window']);
    assert.deepEqual(parsed, { type: 'run', command: ['firefox', '--private-window'], seconds: 10, message: 'Take a breath.', autoOpen: false });
});

test('Chromium moving switches ahead of the app folder does not lose their values', () => {
    const argv = ['/x/electron', '--timeout-launch=spotify.desktop', '/x/desktop', '--'];
    assert.equal(parseTimeoutCommand(argv).appId, 'spotify.desktop');
});

test('timers and the native host reach the running app with their session IDs', () => {
    assert.deepEqual(parseTimeoutCommand(['c', '--timeout-expire-app=abc']), { type: 'expire-app', sessionId: 'abc' });
    assert.deepEqual(parseTimeoutCommand(['c', '--timeout-expire-browser=def']), { type: 'expire-browser', sessionId: 'def' });
    assert.deepEqual(parseTimeoutCommand(['c', '--timeout-watch']), { type: 'watch' });
});

test('launchers point at the AppImage file, the installed binary, or the source checkout', () => {
    assert.deepEqual(selfCommand({ env: { APPIMAGE: '/home/me/Claritard.AppImage' }, execPath: '/tmp/.mount/claritard', isPackaged: true }), ['/home/me/Claritard.AppImage']);
    assert.deepEqual(selfCommand({ env: {}, execPath: '/opt/Claritard/claritard', isPackaged: true }), ['/opt/Claritard/claritard']);
    assert.deepEqual(selfCommand({ env: {}, execPath: '/x/electron', isPackaged: false, appPath: '/x/desktop' }), ['/x/electron', '/x/desktop']);
});
