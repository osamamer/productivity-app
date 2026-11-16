const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseDesktopEntry, serializeDesktopEntry, getString, setString, splitExec, expandExec, quoteExecArgument,
} = require('../src/timeouts/core/desktopEntry');
const { wrapLauncher, isClaritardLauncher, hasForeignWrapper } = require('../src/timeouts/core/launchers');

const SPOTIFY = `[Desktop Entry]
Type=Application
Name=Spotify
Name[de]=Spotify DE
# a comment that must survive
Exec=spotify %U
Icon=spotify-client
DBusActivatable=true

[Desktop Action NewWindow]
Name=New window
Exec=spotify --new-window
`;

test('parsing and serializing leaves an untouched launcher unchanged', () => {
    assert.equal(serializeDesktopEntry(parseDesktopEntry(SPOTIFY)), SPOTIFY);
});

test('setting a new key adds it to its group before the blank separator line', () => {
    const entry = parseDesktopEntry(SPOTIFY);
    setString(entry, 'Desktop Entry', 'Comment', 'Music');
    const text = serializeDesktopEntry(entry);
    assert.match(text, /DBusActivatable=true\nComment=Music\n\n\[Desktop Action NewWindow\]/);
});

test('key-file escapes are undone when reading', () => {
    const entry = parseDesktopEntry('[Desktop Entry]\nName=\\sTwo\\nLines\n');
    assert.equal(getString(entry, 'Desktop Entry', 'Name'), ' Two\nLines');
});

test('Exec lines split like a shell, honouring both quote styles', () => {
    assert.deepEqual(splitExec(`"/opt/My App/app" --flag='a b' "say \\"hi\\"" %U`), ['/opt/My App/app', '--flag=a b', 'say "hi"', '%U']);
});

test('field codes expand to the URIs and launcher details', () => {
    assert.deepEqual(expandExec('app %U --name %c', { uris: ['a', 'b'], name: 'App' }), ['app', 'a', 'b', '--name', 'App']);
    assert.deepEqual(expandExec('app %u', {}), ['app']);
    assert.deepEqual(expandExec('app 100%%', {}), ['app', '100%']);
});

test('a wrapped launcher runs the Claritard countdown for the app and each action', () => {
    const wrapped = wrapLauncher(SPOTIFY, 'spotify.desktop', ['/opt/Claritard/claritard']);
    const entry = parseDesktopEntry(wrapped);
    assert.equal(getString(entry, 'Desktop Entry', 'Exec'), `${quoteExecArgument('/opt/Claritard/claritard')} "--timeout-launch=spotify.desktop" -- %U`);
    assert.equal(getString(entry, 'Desktop Action NewWindow', 'Exec'), '"/opt/Claritard/claritard" "--timeout-launch=spotify.desktop" "--timeout-action=NewWindow" -- %U');
    assert.equal(getString(entry, 'Desktop Entry', 'DBusActivatable'), 'false');
    assert.equal(getString(entry, 'Desktop Entry', 'Name[de]'), 'Spotify DE');
    assert.ok(wrapped.includes('# a comment that must survive'));
    assert.ok(isClaritardLauncher(wrapped));
    assert.ok(!isClaritardLauncher(SPOTIFY));
});

test('launchers already wrapped by App Timeout are recognised', () => {
    assert.ok(hasForeignWrapper('Exec="/usr/bin/app-timeout" launch "spotify.desktop" -- %U'));
    assert.ok(!hasForeignWrapper(SPOTIFY));
});
