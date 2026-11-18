// Firefox native messaging host for URL timers. A one-off request (sendNativeMessage) gets one
// reply. A "watch" request (connectNative) gets the rules now and again whenever the config file
// changes, until Firefox closes the port, so setting changes reach the extension without a reload.
// Runs under Electron in plain Node mode (ELECTRON_RUN_AS_NODE), started by Firefox, so it must
// not require Electron. Installed by copying this file and ./core into the timeouts state folder.
const fs = require('node:fs');
const { timeoutPaths } = require('./core/paths');
const { loadConfig } = require('./core/config');
const { normalizeUrl } = require('./core/urls');
const { grantBrowserRule, browserRulesResponse } = require('./core/browserSession');
const { scheduleCommand, runDetached } = require('./core/systemd');
const { watchFile } = require('./core/fileWatch');

const MAX_MESSAGE_BYTES = 65536;

function readMessage() {
    return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(0);
        process.stdin.on('data', chunk => {
            buffer = Buffer.concat([buffer, chunk]);
            if (buffer.length < 4) return;
            const length = buffer.readUInt32LE(0);
            if (length > MAX_MESSAGE_BYTES) {
                reject(new Error('Native message is too large.'));
                return;
            }
            if (buffer.length >= 4 + length) resolve(JSON.parse(buffer.subarray(4, 4 + length).toString('utf8')));
        });
        process.stdin.on('end', () => resolve(null));
        process.stdin.on('error', reject);
    });
}

function reply(value) {
    const payload = Buffer.from(JSON.stringify(value), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);
    process.stdout.write(Buffer.concat([header, payload]));
}

function launchCommand(paths) {
    return JSON.parse(fs.readFileSync(paths.launchCommandFile, 'utf8')).command;
}

/** Hands a new session to Claritard (for its countdown window) and arms the close timer. */
async function startSessionEnforcement(paths, session) {
    const command = launchCommand(paths);
    await scheduleCommand({
        unit: `claritard-browser-expire-${session.id}`,
        seconds: session.deadline - Date.now() / 1000,
        command: [...command, `--timeout-expire-browser=${session.id}`],
        description: 'Claritard closes Firefox when its URL timer ends',
    });
    await runDetached({
        unit: `claritard-browser-watch-${session.id}`,
        command: [...command, '--timeout-watch'],
        description: 'Claritard Firefox countdown',
    });
}

async function handle(request) {
    const paths = timeoutPaths();
    const config = loadConfig(paths.configFile);
    if (request?.type === 'rules') return browserRulesResponse(config, paths);
    if (request?.type === 'grant') {
        const url = normalizeUrl(request.url ?? '');
        const rule = config.urls[url];
        if (!rule) throw new Error('This URL is not configured.');
        const { session, created } = grantBrowserRule(paths, url, rule);
        if (created) await startSessionEnforcement(paths, session);
        return { ok: true, deadline: session.deadline };
    }
    throw new Error('Unknown browser request.');
}

function currentRules() {
    const paths = timeoutPaths();
    return browserRulesResponse(loadConfig(paths.configFile), paths);
}

function sendRules() {
    try {
        reply({ type: 'rules', ...currentRules() });
    } catch (error) {
        reply({ type: 'rules', error: error instanceof Error ? error.message : String(error) });
    }
}

/** Stays alive until Firefox disconnects, which ends stdin. */
function watchRules() {
    const stop = watchFile(timeoutPaths().configFile, sendRules);
    process.stdin.on('end', () => {
        stop();
        process.exit(0);
    });
    sendRules();
}

async function main() {
    try {
        const request = await readMessage();
        if (request === null) return;
        if (request.type === 'watch') {
            watchRules();
            return;
        }
        reply(await handle(request));
    } catch (error) {
        reply({ error: error instanceof Error ? error.message : String(error) });
    }
}

void main();
