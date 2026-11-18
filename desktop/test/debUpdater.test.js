const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareInstalledDeb } = require('../src/debUpdater');

function cacheDir(files = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-updater-'));
    for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), content);
    }
    return dir;
}
const read = (dir, name) => (fs.existsSync(path.join(dir, name)) ? fs.readFileSync(path.join(dir, name), 'utf8') : null);

test('the installed .deb\'s own blockmap is the one the differential download compares against', async () => {
    const dir = cacheDir({ 'installer.deb': 'deb', 'installer.deb.blockmap': 'installed map', 'current.blockmap': 'map of a newer download' });
    await prepareInstalledDeb(dir, '1.2.5');
    assert.equal(read(dir, 'current.blockmap'), 'installed map');
});

test('without a blockmap for the installed .deb, a stale one is dropped so the old release\'s is fetched', async () => {
    const dir = cacheDir({ 'installer.deb': 'deb', 'current.blockmap': 'map of a newer download' });
    await prepareInstalledDeb(dir, '1.2.5');
    assert.equal(read(dir, 'current.blockmap'), null);
});

test('a .deb left in pending/ by an earlier install of this version becomes the base', async () => {
    const dir = cacheDir({
        'pending/claritard-desktop_1.2.5_amd64.deb': 'installed version',
        'pending/claritard-desktop_1.2.4_amd64.deb': 'older',
        'pending/temp-claritard-desktop_1.2.5_amd64.deb': 'partial',
    });
    await prepareInstalledDeb(dir, '1.2.5');
    assert.equal(read(dir, 'installer.deb'), 'installed version');
});

test('a .deb of another version is never taken as the installed one', async () => {
    const dir = cacheDir({ 'pending/claritard-desktop_1.2.4_amd64.deb': 'older' });
    await prepareInstalledDeb(dir, '1.2.5');
    assert.equal(read(dir, 'installer.deb'), null);
});
