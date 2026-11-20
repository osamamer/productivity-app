const fs = require('node:fs');
const path = require('node:path');
const { normalizeUrl } = require('./urls');

const MAX_DELAY_SECONDS = 86400;
const MAX_CLOSE_AFTER_SECONDS = 86400;
const MAX_DAILY_LIMIT_SECONDS = 86400;
const DEFAULT_MESSAGE = 'Take a breath.';

/**
 * `apps` maps a desktop ID (e.g. `firefox.desktop`) to its delay settings and the backup of its
 * original launcher. `urls` maps a normalized URL to its Firefox timer. `appearance` is the last
 * theme the web app reported, so countdown windows match it even when the app is not open.
 */
function emptyConfig() {
    return { apps: {}, urls: {}, appearance: null };
}

function loadConfig(file) {
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return emptyConfig();
        throw error;
    }
    const parsed = JSON.parse(raw);
    const config = { ...emptyConfig(), ...parsed };
    config.apps = parsed.apps && typeof parsed.apps === 'object' ? parsed.apps : {};
    const urls = {};
    for (const [url, rule] of Object.entries(parsed.urls ?? {})) {
        try {
            urls[normalizeUrl(url)] = rule;
        } catch (error) {
            console.error(`Dropping an invalid URL timer ${url}:`, error);
        }
    }
    config.urls = urls;
    return config;
}

function saveConfig(file, config) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`);
    fs.renameSync(temporary, file);
}

function wholeNumberIn(value, min, max, message) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) throw new Error(message);
    return number;
}

/** Seconds a day an app or site may be used; 0 means no daily limit. */
function dailyLimit(input) {
    return wholeNumberIn(input?.dailyLimitSeconds ?? 0, 0, MAX_DAILY_LIMIT_SECONDS, 'The daily limit must be between 0 and 1440 minutes.');
}

/** Validates what the settings page sends for an app. */
function appSettings(input) {
    return {
        delaySeconds: wholeNumberIn(input?.delaySeconds, 0, MAX_DELAY_SECONDS, 'Delay must be between 0 and 86400 seconds.'),
        closeAfterSeconds: wholeNumberIn(input?.closeAfterSeconds ?? 0, 0, MAX_CLOSE_AFTER_SECONDS, 'Auto-close must be between 0 and 1440 minutes.'),
        dailyLimitSeconds: dailyLimit(input),
        autoOpen: input?.autoOpen !== false,
        message: typeof input?.message === 'string' ? input.message.slice(0, 300) : DEFAULT_MESSAGE,
    };
}

/** Validates what the settings page sends for a URL timer. Firefox always closes afterwards. */
function urlSettings(input) {
    return {
        delaySeconds: wholeNumberIn(input?.delaySeconds, 0, MAX_DELAY_SECONDS, 'Delay must be between 0 and 86400 seconds.'),
        closeAfterSeconds: wholeNumberIn(input?.closeAfterSeconds, 60, MAX_CLOSE_AFTER_SECONDS, 'Firefox must close between 1 and 1440 minutes after opening.'),
        dailyLimitSeconds: dailyLimit(input),
        message: typeof input?.message === 'string' && input.message.trim() ? input.message.slice(0, 300) : DEFAULT_MESSAGE,
    };
}

module.exports = { DEFAULT_MESSAGE, emptyConfig, loadConfig, saveConfig, appSettings, urlSettings };
