const fs = require('node:fs');
const path = require('node:path');

const MODES = new Set(['local', 'cloud']);

function configPath(userDataDir) {
    return path.join(userDataDir, 'config.json');
}

/** Returns the saved choice, or `{ mode: null }` when the user has not chosen yet. */
function readConfig(userDataDir) {
    let raw;
    try {
        raw = fs.readFileSync(configPath(userDataDir), 'utf8');
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Could not read the desktop configuration:', error);
        return { mode: null };
    }
    try {
        const parsed = JSON.parse(raw);
        return { mode: MODES.has(parsed.mode) ? parsed.mode : null };
    } catch (error) {
        console.error('The desktop configuration is not valid JSON; asking for a mode again:', error);
        return { mode: null };
    }
}

function writeConfig(userDataDir, config) {
    fs.mkdirSync(userDataDir, { recursive: true });
    const target = configPath(userDataDir);
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(config, null, 2));
    fs.renameSync(temporary, target);
}

module.exports = { readConfig, writeConfig };
