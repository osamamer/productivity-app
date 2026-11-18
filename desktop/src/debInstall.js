const { spawn: spawnProcess } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/*
 * electron-updater installs a .deb with spawnSync from inside the quitting app: the window
 * freezes while pkexec asks for the password, and dpkg's stdout is a pipe into the app.
 * When the app dies mid-install, dpkg is killed by SIGPIPE between unpack and configure,
 * leaving the package half-installed and the update retried on every launch. Instead this
 * hands the install to a detached shell that waits for the app to exit first.
 */
const INSTALL_SCRIPT = [
    'pid="$1"; deb="$2"; relaunch="$3"',
    'while kill -0 "$pid" 2>/dev/null; do sleep 0.5; done',
    'pkexec --disable-internal-agent dpkg -i "$deb"',
    // Relaunch even when the password prompt was cancelled, so the app never just vanishes.
    'if [ -n "$relaunch" ]; then exec "$relaunch"; fi',
].join('\n');

function isDebInstall(resourcesPath) {
    try {
        return fs.readFileSync(path.join(resourcesPath, 'package-type'), 'utf8').trim() === 'deb';
    } catch {
        return false;
    }
}

function debInstallCommand({ appPid, debPath, relaunchPath = '' }) {
    return ['/bin/sh', ['-c', INSTALL_SCRIPT, 'claritard-update', String(appPid), debPath, relaunchPath]];
}

/** Starts the installer fully detached (own session, no pipes) so it outlives the app. */
function scheduleDebInstall({ appPid, debPath, relaunchPath, env = process.env, spawn = spawnProcess }) {
    const [command, args] = debInstallCommand({ appPid, debPath, relaunchPath });
    const child = spawn(command, args, { detached: true, stdio: 'ignore', env });
    child.unref();
    return child;
}

module.exports = { isDebInstall, debInstallCommand, scheduleDebInstall };
