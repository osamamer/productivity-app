const fs = require('node:fs');
const { appTarget } = require('./appTarget');
const { targetIdentity } = require('./appSessions');
const { readDailyUsage, remainingSeconds } = require('./dailyUsage');

/** The program a configured launcher starts, and the key its daily usage is counted under. */
function entryProgram(entry) {
    const target = appTarget(fs.readFileSync(entry.backup, 'utf8'));
    return { target, identity: targetIdentity(target) };
}

/**
 * Apps with a daily limit, one per program even when several launchers start it (the
 * strictest settings win): `[{ identity, name, target, limitSeconds, countMinimized, onTimeUp }]`.
 */
function limitedApps(config) {
    const byIdentity = new Map();
    for (const entry of Object.values(config.apps)) {
        if (!(entry.dailyLimitSeconds > 0)) continue;
        let program;
        try {
            program = entryProgram(entry);
        } catch (error) {
            console.error(`Could not read the launcher of ${entry.name}:`, error);
            continue;
        }
        const existing = byIdentity.get(program.identity);
        const countMinimized = entry.countMinimized !== false || existing?.countMinimized === true;
        const onTimeUp = entry.onTimeUp === 'minimize' && (!existing || existing.onTimeUp === 'minimize') ? 'minimize' : 'close';
        const strictest = !existing || entry.dailyLimitSeconds < existing.limitSeconds
            ? { ...program, name: entry.name, limitSeconds: entry.dailyLimitSeconds }
            : existing;
        byIdentity.set(program.identity, { ...strictest, countMinimized, onTimeUp });
    }
    return [...byIdentity.values()];
}

/** Seconds `entry`'s program has run today, and how many of its daily limit are left. */
function appUsageToday(paths, entry, now = Date.now()) {
    const used = readDailyUsage(paths, now).apps[entryProgram(entry).identity] ?? 0;
    return { usedSeconds: used, leftSeconds: remainingSeconds(entry.dailyLimitSeconds ?? 0, used) };
}

module.exports = { entryProgram, limitedApps, appUsageToday };
