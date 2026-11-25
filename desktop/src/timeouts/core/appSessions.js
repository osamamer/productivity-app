const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * A timed app session: `{ id, name, target, processes, deadline }` (deadline in epoch ms).
 * Saved to disk so a systemd timer, or Claritard after a restart, can still end it on time.
 */
function targetIdentity(target) {
    const sorted = Object.fromEntries(Object.entries(target).sort(([a], [b]) => a.localeCompare(b)));
    return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
}

function sessionFile(paths, id) {
    return path.join(paths.appSessionsDir, `${id}.json`);
}

function saveAppSession(paths, session) {
    fs.mkdirSync(paths.appSessionsDir, { recursive: true });
    const file = sessionFile(paths, session.id);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(session));
    fs.renameSync(`${file}.tmp`, file);
}

function readAppSession(paths, id) {
    try {
        return JSON.parse(fs.readFileSync(sessionFile(paths, id), 'utf8'));
    } catch {
        return null;
    }
}

function listAppSessions(paths) {
    let names;
    try {
        names = fs.readdirSync(paths.appSessionsDir);
    } catch {
        return [];
    }
    return names
        .filter(name => name.endsWith('.json'))
        .map(name => readAppSession(paths, name.slice(0, -'.json'.length)))
        .filter(Boolean);
}

function removeAppSession(paths, id) {
    fs.rmSync(sessionFile(paths, id), { force: true });
}

/**
 * The saved session for the program with `identity` whose time has not run out yet, or null.
 * A session outlives its app's window: reopening the app before the deadline continues it.
 */
function liveAppSession(paths, identity, now = Date.now()) {
    return listAppSessions(paths).find(session =>
        (session.identity ?? targetIdentity(session.target)) === identity && session.deadline > now) ?? null;
}

module.exports = {
    targetIdentity, saveAppSession, readAppSession, listAppSessions, removeAppSession, liveAppSession,
};
