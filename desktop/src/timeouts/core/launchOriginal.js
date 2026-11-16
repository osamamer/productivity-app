const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { MAIN_GROUP, ACTION_PREFIX, parseDesktopEntry, getString, expandExec } = require('./desktopEntry');
const { which } = require('./appTarget');

/** Environment variables Electron sets for itself that must not leak into launched apps. */
const ELECTRON_ONLY_ENV = ['ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ATTACH_CONSOLE', 'CHROME_DESKTOP', 'ORIGINAL_XDG_CURRENT_DESKTOP'];

function cleanEnvironment(env) {
    const clean = { ...env };
    for (const key of ELECTRON_ONLY_ENV) delete clean[key];
    if (env.ORIGINAL_XDG_CURRENT_DESKTOP) clean.XDG_CURRENT_DESKTOP = env.ORIGINAL_XDG_CURRENT_DESKTOP;
    return clean;
}

/**
 * Starts the app an original launcher describes, detached from Claritard, the way a desktop
 * menu would: its Exec line with field codes expanded, in its working directory.
 */
function launchOriginal(backupFile, { uris = [], action = null } = {}) {
    const entry = parseDesktopEntry(fs.readFileSync(backupFile, 'utf8'));
    const group = action ? `${ACTION_PREFIX}${action}` : MAIN_GROUP;
    const exec = getString(entry, group, 'Exec');
    if (!exec) throw new Error('The original application launcher is invalid.');
    const argv = expandExec(exec, {
        uris,
        name: getString(entry, MAIN_GROUP, 'Name') ?? '',
        icon: getString(entry, MAIN_GROUP, 'Icon'),
        file: backupFile,
    });
    if (!argv.length) throw new Error('The original application launcher is invalid.');
    const workingDir = getString(entry, MAIN_GROUP, 'Path');
    spawnDetached(argv, workingDir && fs.existsSync(workingDir) ? workingDir : undefined);
}

function spawnDetached(argv, cwd) {
    const env = cleanEnvironment(process.env);
    const executable = which(argv[0], env);
    if (!executable) throw new Error(`${argv[0]} is not installed.`);
    const child = spawn(executable, argv.slice(1), { cwd, env, detached: true, stdio: 'ignore' });
    child.on('error', error => console.error(`Could not start ${argv[0]}:`, error));
    child.unref();
}

module.exports = { launchOriginal, spawnDetached, cleanEnvironment };
