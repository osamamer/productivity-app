const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { timeoutPaths } = require('../src/timeouts/core/paths');
const { saveConfig } = require('../src/timeouts/core/config');

const HOST = path.join(__dirname, '..', 'src', 'timeouts', 'nativeHost.js');

function frame(value) {
    const payload = Buffer.from(JSON.stringify(value), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);
    return Buffer.concat([header, payload]);
}

/** Starts the host as Firefox would and yields each framed reply in order. */
function startHost(env) {
    const child = spawn(process.execPath, [HOST], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'inherit'] });
    let buffer = Buffer.alloc(0);
    const waiting = [];
    const replies = [];
    child.stdout.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32LE(0)) {
            const length = buffer.readUInt32LE(0);
            const message = JSON.parse(buffer.subarray(4, 4 + length).toString('utf8'));
            buffer = buffer.subarray(4 + length);
            const next = waiting.shift();
            if (next) next(message); else replies.push(message);
        }
    });
    return {
        child,
        send: value => child.stdin.write(frame(value)),
        next: () => replies.length ? Promise.resolve(replies.shift()) : new Promise(resolve => waiting.push(resolve)),
    };
}

function tempEnv() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-host-'));
    return { HOME: root, XDG_DATA_HOME: path.join(root, 'data'), XDG_CONFIG_HOME: path.join(root, 'config') };
}

function rule(seconds) {
    return { delaySeconds: seconds, closeAfterSeconds: 600, message: '' };
}

test('a one-off rules request gets the current timers and the host exits', async () => {
    const env = tempEnv();
    const paths = timeoutPaths(env);
    saveConfig(paths.configFile, { apps: {}, urls: { 'https://youtube.com/': rule(20) }, appearance: null });
    const host = startHost(env);
    host.send({ type: 'rules' });
    const answer = await host.next();
    assert.deepEqual(answer.rules.map(r => [r.url, r.delay]), [['https://youtube.com/', 20]]);
    host.child.stdin.end();
    await new Promise(resolve => host.child.on('exit', resolve));
});

test('a watching extension gets new timers as soon as Claritard saves them, without reconnecting', async () => {
    const env = tempEnv();
    const paths = timeoutPaths(env);
    saveConfig(paths.configFile, { apps: {}, urls: { 'https://youtube.com/': rule(20) }, appearance: null });
    const host = startHost(env);
    host.send({ type: 'watch' });

    const first = await host.next();
    assert.equal(first.type, 'rules');
    assert.deepEqual(first.rules.map(r => r.delay), [20]);

    saveConfig(paths.configFile, {
        apps: {},
        urls: { 'https://youtube.com/': rule(45), 'https://reddit.com/': rule(10) },
        appearance: null,
    });
    const second = await host.next();
    assert.deepEqual(second.rules.map(r => [r.url, r.delay]).sort(), [['https://reddit.com/', 10], ['https://youtube.com/', 45]]);

    host.child.stdin.end();
    const code = await new Promise(resolve => host.child.on('exit', resolve));
    assert.equal(code, 0, 'closing the port ends the host');
});

test('watching works before Claritard has ever saved a timer', async () => {
    const env = tempEnv();
    const host = startHost(env);
    host.send({ type: 'watch' });
    assert.deepEqual((await host.next()).rules, []);

    saveConfig(timeoutPaths(env).configFile, { apps: {}, urls: { 'https://example.com/': rule(5) }, appearance: null });
    assert.deepEqual((await host.next()).rules.map(r => r.url), ['https://example.com/']);
    host.child.kill();
});
