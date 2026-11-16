const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { withFileLock } = require('./fileLock');
const { which } = require('./appTarget');
const { runningProcesses, endSession } = require('./processes');

/**
 * One Firefox session opened through a URL timer: `{ id, startedAt, deadline, name, rules, target }`.
 * Times are epoch seconds. Every timed URL granted during the session shares its deadline,
 * and the file outlives Firefox, so closing and reopening Firefox does not reset the time.
 */
function readSession(paths) {
    try {
        return JSON.parse(fs.readFileSync(paths.browserSessionFile, 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Could not read the Firefox timer session:', error);
        return null;
    }
}

function writeSession(paths, session) {
    fs.mkdirSync(path.dirname(paths.browserSessionFile), { recursive: true });
    const temporary = `${paths.browserSessionFile}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(session)}\n`);
    fs.renameSync(temporary, paths.browserSessionFile);
}

function nowSeconds() {
    return Date.now() / 1000;
}

function activeSession(paths) {
    const session = readSession(paths);
    return session && session.deadline > nowSeconds() ? session : null;
}

/** The Firefox build whose processes are closed when time is up. */
function firefoxTarget(home, env = process.env) {
    const developer = path.join(home, 'Applications', 'firefox-developer-edition', 'firefox');
    const snap = '/snap/firefox/current/usr/lib/firefox/firefox';
    const executable = fs.existsSync(developer) ? developer : fs.existsSync(snap) ? snap : which('firefox', env);
    if (!executable) throw new Error('Firefox is not installed.');
    const head = Buffer.alloc(2);
    const fd = fs.openSync(executable, 'r');
    try {
        fs.readSync(fd, head, 0, 2, 0);
    } finally {
        fs.closeSync(fd);
    }
    if (head.toString() === '#!') throw new Error('The Firefox launcher is a script; its process cannot be tracked safely.');
    return { executable: fs.realpathSync(executable) };
}

/**
 * Unlocks `url` for the current Firefox session, starting one with the rule's duration if none
 * is running. Returns `{ session, created }`.
 */
function grantBrowserRule(paths, url, rule) {
    return withFileLock(paths.browserLockFile, () => {
        const session = readSession(paths);
        if (session && session.deadline <= nowSeconds()) {
            throw new Error('The Firefox timer has ended. Wait for Firefox to close, then reopen it.');
        }
        if (session) {
            if (!session.rules.includes(url)) {
                session.rules.push(url);
                writeSession(paths, session);
            }
            return { session, created: false };
        }
        const startedAt = nowSeconds();
        const created = {
            id: crypto.randomBytes(8).toString('hex'),
            startedAt,
            deadline: startedAt + rule.closeAfterSeconds,
            name: url,
            rules: [url],
            target: firefoxTarget(paths.home),
        };
        writeSession(paths, created);
        return { session: created, created: true };
    });
}

/** Closes Firefox if session `id` is still the current one and its time is up. */
async function expireBrowser(paths, id) {
    const session = readSession(paths);
    if (!session || session.id !== id || session.deadline > nowSeconds()) return false;
    const victims = runningProcesses(session.target);
    await endSession(session.target, victims);
    withFileLock(paths.browserLockFile, () => {
        if (readSession(paths)?.id === id) fs.rmSync(paths.browserSessionFile, { force: true });
    });
    return true;
}

/** What the Firefox extension needs: the timers, and which are unlocked until when. */
function browserRulesResponse(config, paths) {
    const session = activeSession(paths);
    return {
        rules: Object.entries(config.urls).map(([url, rule]) => ({
            url,
            delay: rule.delaySeconds,
            duration: rule.closeAfterSeconds,
            message: rule.message,
        })),
        deadline: session ? session.deadline : 0,
        unlocked: session ? session.rules : [],
        appearance: config.appearance ?? null,
    };
}

module.exports = { readSession, activeSession, grantBrowserRule, expireBrowser, browserRulesResponse, firefoxTarget };
