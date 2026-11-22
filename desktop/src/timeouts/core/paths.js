const os = require('node:os');
const path = require('node:path');

/**
 * Where app timeouts keep their files. A pure function of the environment so the Firefox
 * native host, which runs outside Electron, finds the same files as the app.
 */
function timeoutPaths(env = process.env) {
    const home = env.HOME || os.homedir();
    const dataHome = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    const configHome = env.XDG_CONFIG_HOME || path.join(home, '.config');
    const stateDir = path.join(dataHome, 'Claritard', 'timeouts');
    return {
        home,
        dataHome,
        stateDir,
        configFile: path.join(configHome, 'Claritard', 'timeouts.json'),
        applicationsDir: path.join(dataHome, 'applications'),
        originalsDir: path.join(stateDir, 'originals'),
        appSessionsDir: path.join(stateDir, 'app-sessions'),
        browserSessionFile: path.join(stateDir, 'browser-session.json'),
        browserTabsFile: path.join(stateDir, 'browser-tabs.json'),
        browserLockFile: path.join(stateDir, 'browser-session.lock'),
        dailyUsageFile: path.join(stateDir, 'daily-usage.json'),
        dailyUsageLockFile: path.join(stateDir, 'daily-usage.lock'),
        passwordFile: path.join(stateDir, 'password.json'),
        browserHostDir: path.join(stateDir, 'browser-host'),
        launchCommandFile: path.join(stateDir, 'browser-host', 'launch.json'),
        firefoxHostManifestDir: path.join(home, '.mozilla', 'native-messaging-hosts'),
        logFile: path.join(stateDir, 'timeouts.log'),
    };
}

module.exports = { timeoutPaths };
