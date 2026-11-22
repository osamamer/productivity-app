const fs = require('node:fs');
const path = require('node:path');

// Opt-in: nothing is recorded until the user turns tracking on.
const DEFAULTS = Object.freeze({ enabled: false, recordTitles: true });

/**
 * Screen-time settings live in their own file rather than the desktop config, because the
 * storage-mode chooser rewrites that file with only the mode.
 */
function readUsageSettings(file) {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') console.error(`Could not read screen-time settings, using defaults: ${error.message}`, error);
        return { ...DEFAULTS };
    }
    return {
        enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
        ...(parsed?.activityByApp && { activityByApp: activityAssignments(parsed.activityByApp) }),
        recordTitles: typeof parsed?.recordTitles === 'boolean' ? parsed.recordTitles : DEFAULTS.recordTitles,
    };
}

function activityAssignments(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
    return Object.fromEntries(Object.entries(input).filter(([appId, activityId]) =>
        appId.length > 0 && appId.length <= 512
        && typeof activityId === 'string' && activityId.length > 0 && activityId.length <= 128,
    ));
}

function writeUsageSettings(file, settings) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify({ enabled: Boolean(settings.enabled), recordTitles: Boolean(settings.recordTitles), activityByApp: activityAssignments(settings.activityByApp) }, null, 2)}\n`);
    fs.renameSync(temporary, file);
}

module.exports = { activityAssignments, readUsageSettings, writeUsageSettings };
