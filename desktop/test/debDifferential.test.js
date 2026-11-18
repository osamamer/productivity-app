const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readAr, writeAr, readTarEntries, normalizeTar, updateLatestYml } = require('../scripts/debDifferential');

// Builds a real tar with GNU tar from files written in a fresh folder, in the order given.
function tarOf(files, mtime) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-tar-'));
    for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), content);
        fs.utimesSync(path.join(dir, name), mtime, mtime);
    }
    return execFileSync('tar', ['-c', '--no-recursion', '-C', dir, ...Object.keys(files)]);
}

test('the same files give byte-identical archives whatever their order and modification times', () => {
    const files = { 'opt/b.txt': 'bee', 'opt/a.txt': 'ay' };
    const first = normalizeTar(tarOf(files, 1000));
    const second = normalizeTar(tarOf({ 'opt/a.txt': 'ay', 'opt/b.txt': 'bee' }, 999999));
    assert.ok(first.equals(second));
});

test('normalizing keeps every file and its content, sorted by name', () => {
    const tar = normalizeTar(tarOf({ 'z.txt': 'last', 'a.txt': 'first' }, 1000));
    assert.deepEqual(readTarEntries(tar).map(entry => entry.name), ['a.txt', 'z.txt']);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-untar-'));
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    assert.equal(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'first');
});

test('names longer than a tar header holds stay with their file when sorted', () => {
    const long = `${'d'.repeat(120)}/file.txt`;
    const tar = normalizeTar(tarOf({ [long]: 'deep', 'a.txt': 'top' }, 1000));
    assert.deepEqual(readTarEntries(tar).map(entry => entry.name), ['a.txt', long]);
});

test('an ar archive (the .deb container) reads back what was written', () => {
    const members = [{ name: 'debian-binary', data: Buffer.from('2.0\n') }, { name: 'data.tar.zst', data: Buffer.from('odd') }];
    const read = readAr(writeAr(members));
    assert.deepEqual(read.map(member => [member.name, member.data.toString()]), [['debian-binary', '2.0\n'], ['data.tar.zst', 'odd']]);
});

test('only the .deb entry of latest-linux.yml gets the new size and checksum', () => {
    const yml = [
        'version: 1.2.9',
        'files:',
        '  - url: Claritard-1.2.9.AppImage',
        '    sha512: appimage',
        '    size: 10',
        '  - url: claritard-desktop_1.2.9_amd64.deb',
        '    sha512: old',
        '    size: 20',
        'path: Claritard-1.2.9.AppImage',
        'sha512: appimage',
    ].join('\n');
    const updated = updateLatestYml(yml, 'claritard-desktop_1.2.9_amd64.deb', { sha512: 'new', size: 30 });
    assert.match(updated, /amd64\.deb\n {4}sha512: new\n {4}size: 30\n/);
    assert.match(updated, /AppImage\n {4}sha512: appimage\n {4}size: 10\n/);
    assert.match(updated, /\nsha512: appimage$/);
});
