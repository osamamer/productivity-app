const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readConfig, writeConfig } = require('../src/config');

function temporaryDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-config-'));
}

test('a fresh install has no storage mode, so the chooser is shown', () => {
    assert.deepEqual(readConfig(temporaryDir()), { mode: null });
});

test('a saved choice is read back on the next launch', () => {
    const dir = temporaryDir();
    writeConfig(dir, { mode: 'cloud' });
    assert.deepEqual(readConfig(dir), { mode: 'cloud' });
});

test('an unknown mode asks for a mode again', () => {
    const dir = temporaryDir();
    writeConfig(dir, { mode: 'somewhere-else' });
    assert.equal(readConfig(dir).mode, null);
});

test('a corrupt configuration file asks for a mode again', () => {
    const dir = temporaryDir();
    fs.writeFileSync(path.join(dir, 'config.json'), '{not json');
    assert.equal(readConfig(dir).mode, null);
});
