const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { desktopKind } = require('../src/usage/core/desktop');
const { EXTENSION_UUID, installExtension, extensionProblem } = require('../src/usage/core/gnomeExtension');
const { usagePaths } = require('../src/usage/core/paths');

const BUNDLED_EXTENSION = path.join(__dirname, '..', 'src', 'usage', 'gnome');

test('the desktop is read from every name in XDG_CURRENT_DESKTOP', () => {
    assert.equal(desktopKind({ XDG_CURRENT_DESKTOP: 'KDE' }), 'kde');
    assert.equal(desktopKind({ XDG_CURRENT_DESKTOP: 'GNOME' }), 'gnome');
    assert.equal(desktopKind({ XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' }), 'gnome');
    assert.equal(desktopKind({ XDG_CURRENT_DESKTOP: 'X-Cinnamon' }), null);
    assert.equal(desktopKind({}), null);
});

test('the GNOME extension is installed into the user extensions folder under its uuid', () => {
    const paths = usagePaths({ HOME: '/home/ada' });
    assert.equal(paths.gnomeExtensionsDir, '/home/ada/.local/share/gnome-shell/extensions');
    const metadata = JSON.parse(fs.readFileSync(path.join(BUNDLED_EXTENSION, 'metadata.json'), 'utf8'));
    assert.equal(metadata.uuid, EXTENSION_UUID);
});

test('installing the extension writes only when the bundled files differ', () => {
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-gnome-')), EXTENSION_UUID);
    assert.equal(installExtension(BUNDLED_EXTENSION, target), true);
    assert.deepEqual(fs.readdirSync(target).sort(), ['extension.js', 'metadata.json']);
    assert.equal(installExtension(BUNDLED_EXTENSION, target), false);

    fs.writeFileSync(path.join(target, 'extension.js'), '// an older version');
    assert.equal(installExtension(BUNDLED_EXTENSION, target), true);
    assert.equal(
        fs.readFileSync(path.join(target, 'extension.js'), 'utf8'),
        fs.readFileSync(path.join(BUNDLED_EXTENSION, 'extension.js'), 'utf8'),
    );
});

test('a running extension is no problem', () => {
    assert.equal(extensionProblem({ state: 1 }), null);
});

test('an extension the shell has never seen needs one new login', () => {
    assert.match(extensionProblem({}), /Log out and back in/);
});

test('extensions turned off in GNOME are reported before anything else', () => {
    assert.match(extensionProblem({ state: 1 }, { userExtensionsEnabled: false }), /Extensions app/);
});

test('a failing or out-of-date extension says why', () => {
    assert.match(extensionProblem({ state: 3, error: 'TypeError: x is null' }), /TypeError: x is null/);
    assert.match(extensionProblem({ state: 4 }), /too new/);
    assert.match(extensionProblem({ state: 2 }), /did not turn on/);
});
