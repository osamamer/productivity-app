const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { withFileLock } = require('./fileLock');
const { which } = require('./appTarget');
const { runningProcesses, endSession } = require('./processes');
const { readDailyUsage, addDailyUsage, startOfLocalDay, remainingSeconds } = require('./dailyUsage');

/**
 * One Firefox session opened through a URL timer:
 * `{ id, startedAt, deadline, name, rules, grants: {url: grantedAt}, target }`.
 * Times are epoch seconds. Every timed URL granted during the session shares its deadline,
 * and the file outlives Firefox, so closing and reopening Firefox does not reset the time.
 * A URL's time counts toward its daily limit from its grant until the session's deadline.
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

function grantedAt(session, url) {
    return session.grants?.[url] ?? session.startedAt;
}

/** Seconds of `session` that count toward `url`'s limit today, up to `nowSec`. */
function liveSecondsToday(session, url, nowSec) {
    if (!session?.rules.includes(url)) return 0;
    const from = Math.max(grantedAt(session, url), startOfLocalDay(nowSec * 1000) / 1000);
    return Math.max(0, Math.min(nowSec, session.deadline) - from);
}

/** Seconds `url` has been open today, counting the running session. */
function urlSecondsToday(paths, url, session = readSession(paths), nowSec = nowSeconds()) {
    return (readDailyUsage(paths, nowSec * 1000).urls[url] ?? 0) + liveSecondsToday(session, url, nowSec);
}

function dailyLimitReached(url) {
    const site = url.replace(/^https?:\/\//, '');
    return Object.assign(new Error(`The daily limit for ${site} is used up. It opens again tomorrow.`), { code: 'daily-limit' });
}

/**
 * Unlocks `url` for the current Firefox session, starting one with the rule's duration if none
 * is running. A daily limit can bring the session's deadline forward. Returns
 * `{ session, created, shortened }`.
 */
function grantBrowserRule(paths, url, rule) {
    return withFileLock(paths.browserLockFile, () => {
        const session = readSession(paths);
        const now = nowSeconds();
        if (session && session.deadline <= now) {
            throw new Error('The Firefox timer has ended. Wait for Firefox to close, then reopen it.');
        }
        if (session?.rules.includes(url)) return { session, created: false, shortened: false };
        const left = remainingSeconds(rule.dailyLimitSeconds ?? 0, urlSecondsToday(paths, url, session, now));
        if (left <= 0) throw dailyLimitReached(url);
        if (session) {
            session.rules.push(url);
            session.grants = { ...session.grants, [url]: now };
            const shortened = now + left < session.deadline;
            if (shortened) session.deadline = now + left;
            writeSession(paths, session);
            return { session, created: false, shortened };
        }
        const created = {
            id: crypto.randomBytes(8).toString('hex'),
            startedAt: now,
            deadline: now + Math.min(rule.closeAfterSeconds, left),
            name: url,
            rules: [url],
            grants: { [url]: now },
            target: firefoxTarget(paths.home),
        };
        writeSession(paths, created);
        return { session: created, created: true, shortened: false };
    });
}

const TAB_PRESENCE_TTL_MS = 20_000;

function readTabPresence(paths, sessionId) {
    try {
        const data = JSON.parse(fs.readFileSync(paths.browserTabsFile, 'utf8'));
        return data.sessionId === sessionId ? data.profiles : null;
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Could not read timed tab presence:', error);
        return null;
    }
}

function recordTabPresence(paths, { sessionId, profileId, hasTimedTab }, now = Date.now()) {
    if (typeof profileId !== 'string' || !/^[0-9a-f-]{36}$/.test(profileId)
        || typeof hasTimedTab !== 'boolean') throw new Error('Invalid timed tab presence.');
    return withFileLock(paths.browserLockFile, () => {
        if (activeSession(paths)?.id !== sessionId || !sessionId) return false;
        const profiles = Object.fromEntries(Object.entries(readTabPresence(paths, sessionId) ?? {})
            .filter(([, entry]) => entry.expiresAt > now));
        profiles[profileId] = { hasTimedTab, expiresAt: now + TAB_PRESENCE_TTL_MS };
        const temporary = `${paths.browserTabsFile}.tmp`;
        fs.writeFileSync(temporary, JSON.stringify({ sessionId, profiles }));
        fs.renameSync(temporary, paths.browserTabsFile);
        return true;
    });
}

/** Old extensions send no presence information, so use Firefox process visibility for them. */
function hasTimedBrowserTab(paths, sessionId, now = Date.now()) {
    const profiles = readTabPresence(paths, sessionId);
    return profiles === null || Object.values(profiles).some(entry => entry.hasTimedTab && entry.expiresAt > now);
}

/** Adds an ended session's time to each of its URLs' daily usage. */
function recordSessionUsage(paths, session) {
    for (const url of session.rules) addDailyUsage(paths, 'urls', url, liveSecondsToday(session, url, session.deadline));
}

/**
 * Closes Firefox, in every profile, if session `id` is still the current one and its time is up.
 * Timed sites can be opened from any profile, so a `--profile` launch must not escape.
 */
async function expireBrowser(paths, id) {
    const session = readSession(paths);
    if (!session || session.id !== id || session.deadline > nowSeconds()) return false;
    const target = { ...session.target, anyProfile: true };
    await endSession(target, runningProcesses(target));
    withFileLock(paths.browserLockFile, () => {
        const current = readSession(paths);
        if (current?.id !== id) return;
        recordSessionUsage(paths, current);
        fs.rmSync(paths.browserSessionFile, { force: true });
        if (paths.browserTabsFile) fs.rmSync(paths.browserTabsFile, { force: true });
    });
    return true;
}

/**
 * What the Firefox extension needs: the timers, how much of each daily limit is used (a hint
 * for the gate page; granting checks again), and which are unlocked until when.
 */
function browserRulesResponse(config, paths) {
    const session = activeSession(paths);
    const current = readSession(paths);
    return {
        rules: Object.entries(config.urls).map(([url, rule]) => ({
            url,
            delay: rule.delaySeconds,
            duration: rule.closeAfterSeconds,
            dailyLimit: rule.dailyLimitSeconds ?? 0,
            usedToday: Math.round(urlSecondsToday(paths, url, current)),
            message: rule.message,
        })),
        sessionId: session?.id ?? null,
        deadline: session ? session.deadline : 0,
        unlocked: session ? session.rules : [],
        appearance: config.appearance ?? null,
    };
}

module.exports = {
    readSession, activeSession, grantBrowserRule, expireBrowser, browserRulesResponse, firefoxTarget, urlSecondsToday, recordTabPresence, hasTimedBrowserTab,
};
