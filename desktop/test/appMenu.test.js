const test = require('node:test');
const assert = require('node:assert/strict');
const { menuItems, createCommands } = require('../src/appMenu');

const ids = mode => menuItems(mode).filter(item => !item.separator).map(item => item.id);

test('local folders appear in the menu only in local mode', () => {
    assert.ok(ids('local').includes('openLocalDataFolder'));
    assert.ok(ids('local').includes('openLogsFolder'));
    assert.equal(ids('cloud').includes('openLocalDataFolder'), false);
    assert.equal(ids('cloud').includes('openLogsFolder'), false);
});

test('every menu entry runs a command', () => {
    const noop = () => {};
    const commands = createCommands({
        window: {},
        content: { webContents: {} },
        actions: { changeStorageMode: noop, openLocalDataFolder: noop, openLogsFolder: noop, aboutStorage: noop, checkForUpdates: noop, quit: noop },
    });
    for (const id of ids('local')) assert.equal(typeof commands[id], 'function', id);
});
