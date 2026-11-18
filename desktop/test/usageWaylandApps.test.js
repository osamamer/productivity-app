const test = require('node:test');
const assert = require('node:assert/strict');
const { uint, string, encodeMessage, decodeMessages, decodeGlobal } = require('../src/usage/core/waylandWire');
const { describeApp } = require('../src/usage/core/apps');

test('a Wayland message carries object id, size and opcode in its header', () => {
    const message = encodeMessage(1, 1, [uint(2)]);
    assert.equal(message.length, 12);
    assert.equal(message.readUInt32LE(0), 1);
    assert.equal(message.readUInt32LE(4), (12 << 16) | 1);
    assert.equal(message.readUInt32LE(8), 2);
});

test('Wayland strings are NUL-terminated and padded to four bytes', () => {
    const encoded = string('wl_seat');
    assert.equal(encoded.readUInt32LE(0), 8);
    assert.equal(encoded.length, 12);
});

test('decoding keeps a partial message for the next chunk', () => {
    const whole = Buffer.concat([encodeMessage(5, 0, []), encodeMessage(6, 1, [uint(7)])]);
    const { messages, rest } = decodeMessages(whole.subarray(0, 14));
    assert.deepEqual(messages.map(message => message.objectId), [5]);
    assert.equal(rest.length, 6);
});

test('a registry global is read back with its interface name and version', () => {
    const body = Buffer.concat([uint(19), string('ext_idle_notifier_v1'), uint(2)]);
    assert.deepEqual(decodeGlobal(body), { name: 19, interface: 'ext_idle_notifier_v1', version: 2 });
});

const launchers = new Map([
    ['org.kde.dolphin.desktop', { name: 'Dolphin', icon: 'system-file-manager' }],
    ['firefox.desktop', { name: 'Firefox', icon: 'firefox' }],
]);
const iconFor = name => `icon:${name}`;

test('an app is named after its installed launcher', () => {
    assert.deepEqual(describeApp('org.kde.dolphin', launchers, iconFor), { id: 'org.kde.dolphin', name: 'Dolphin', icon: 'icon:system-file-manager' });
});

test('a window class is matched to its launcher regardless of case', () => {
    assert.equal(describeApp('Firefox', launchers, iconFor).name, 'Firefox');
});

test('an app without a launcher gets a readable name from its id', () => {
    assert.deepEqual(describeApp('org.example.notes', launchers, iconFor), { id: 'org.example.notes', name: 'Notes', icon: null });
});
