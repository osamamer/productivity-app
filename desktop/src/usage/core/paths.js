const os = require('node:os');
const path = require('node:path');

/** Where screen-time tracking keeps its files. A pure function of the environment, for tests. */
function usagePaths(env = process.env) {
    const home = env.HOME || os.homedir();
    const dataHome = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    const configHome = env.XDG_CONFIG_HOME || path.join(home, '.config');
    const dataDir = path.join(dataHome, 'Claritard', 'usage');
    return {
        dataDir,
        daysDir: path.join(dataDir, 'days'),
        kwinScriptFile: path.join(dataDir, 'claritard-usage-kwin.js'),
        settingsFile: path.join(configHome, 'Claritard', 'usage.json'),
        autostartFile: path.join(configHome, 'autostart', 'claritard.desktop'),
    };
}

module.exports = { usagePaths };
