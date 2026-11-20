const fs = require('node:fs');
const path = require('node:path');
const { withFileLock } = require('./fileLock');

/** "YYYY-MM-DD" of `ms` in local time; daily limits reset at local midnight. */
function localDate(ms) {
    const date = new Date(ms);
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfLocalDay(ms) {
    const date = new Date(ms);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function emptyUsage(date) {
    return { date, apps: {}, urls: {} };
}

/**
 * Seconds used today toward daily limits: `{ date, apps: {identity: s}, urls: {url: s} }`.
 * Only today matters, so a file from an earlier day reads as empty.
 */
function readDailyUsage(paths, now = Date.now()) {
    const today = localDate(now);
    try {
        const parsed = JSON.parse(fs.readFileSync(paths.dailyUsageFile, 'utf8'));
        if (parsed?.date !== today) return emptyUsage(today);
        return { date: today, apps: parsed.apps ?? {}, urls: parsed.urls ?? {} };
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Could not read the daily limit usage:', error);
        return emptyUsage(today);
    }
}

/**
 * Adds `seconds` to today's count for `key` (`kind` is "apps" or "urls"). Shared with the
 * Firefox native host, so it holds a lock while it reads and writes.
 */
function addDailyUsage(paths, kind, key, seconds, now = Date.now()) {
    if (!(seconds > 0)) return;
    withFileLock(paths.dailyUsageLockFile, () => {
        const usage = readDailyUsage(paths, now);
        usage[kind][key] = (usage[kind][key] ?? 0) + seconds;
        fs.mkdirSync(path.dirname(paths.dailyUsageFile), { recursive: true });
        const temporary = `${paths.dailyUsageFile}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(usage)}\n`);
        fs.renameSync(temporary, paths.dailyUsageFile);
    });
}

/** Seconds of a daily limit left, or Infinity when there is no limit. */
function remainingSeconds(limitSeconds, usedSeconds) {
    return limitSeconds > 0 ? Math.max(0, limitSeconds - usedSeconds) : Infinity;
}

module.exports = { localDate, startOfLocalDay, readDailyUsage, addDailyUsage, remainingSeconds };
