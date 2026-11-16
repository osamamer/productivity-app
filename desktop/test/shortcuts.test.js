const test = require('node:test');
const assert = require('node:assert/strict');
const { shortcutFor } = require('../src/shortcuts');

const press = (key, modifiers = {}) => ({ type: 'keyDown', key, control: false, meta: false, shift: false, alt: false, ...modifiers });

test('the usual browser shortcuts work without a menu bar', () => {
    assert.equal(shortcutFor(press('r', { control: true })), 'reload');
    assert.equal(shortcutFor(press('=', { control: true })), 'zoomIn');
    assert.equal(shortcutFor(press('-', { control: true })), 'zoomOut');
    assert.equal(shortcutFor(press('0', { control: true })), 'zoomReset');
    assert.equal(shortcutFor(press('F11')), 'fullscreen');
    assert.equal(shortcutFor(press('I', { control: true, shift: true })), 'devtools');
    assert.equal(shortcutFor(press('q', { control: true })), 'quit');
});

test('plain typing and key releases are left to the page', () => {
    assert.equal(shortcutFor(press('r')), null);
    assert.equal(shortcutFor({ ...press('r', { control: true }), type: 'keyUp' }), null);
    assert.equal(shortcutFor(press('c', { control: true })), null);
});
