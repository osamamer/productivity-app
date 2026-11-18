const { spawn: spawnProcess } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { INSTALLED_DEB, INSTALLED_BLOCKMAP } = require('./debUpdater');

/*
 * electron-updater installs a .deb with spawnSync from inside the quitting app: the window
 * freezes while pkexec asks for the password, and dpkg's stdout is a pipe into the app.
 * When the app dies mid-install, dpkg is killed by SIGPIPE between unpack and configure,
 * leaving the package half-installed and the update retried on every launch. Instead this
 * hands the install to a detached shell that waits for the app to exit first.
 *
 * While that shell runs, its PID sits in a marker file. A Claritard opened in the meantime would
 * have its files replaced under it by dpkg and abort ("GPU process isn't usable"), so it reads the
 * marker, defers its own launch until the install is done, and exits (see deferLaunchUntilInstalled).
 *
 * After a successful install the .deb (in <cache>/pending/) and its blockmap move to the cache
 * directory, where the next update copies unchanged blocks from them (see debUpdater.js).
 */
const SCRIPT_NAME = 'claritard-update';

const INSTALL_SCRIPT = [
    'pid="$1"; deb="$2"; relaunch="$3"; marker="$4"',
    'while kill -0 "$pid" 2>/dev/null; do sleep 0.5; done',
    'if pkexec --disable-internal-agent dpkg -i "$deb"; then',
    '  pending="$(dirname "$deb")"; cache="$(dirname "$pending")"',
    `  mv -f "$deb" "$cache/${INSTALLED_DEB}" && { cp -f "$pending/current.blockmap" "$cache/${INSTALLED_BLOCKMAP}" 2>/dev/null || rm -f "$cache/${INSTALLED_BLOCKMAP}"; }`,
    'fi',
    'rm -f "$marker"',
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

// Waits for the installer to finish, then starts Claritard again with the deferred launch's arguments.
const WAIT_SCRIPT = [
    'installer="$1"; shift',
    'while kill -0 "$installer" 2>/dev/null; do sleep 0.5; done',
    'exec "$@"',
].join('\n');

function installMarkerPath(env = process.env) {
    return path.join(env.XDG_RUNTIME_DIR || os.tmpdir(), 'claritard-update.pid');
}

function debInstallCommand({ appPid, debPath, relaunchPath = '', markerPath = installMarkerPath() }) {
    return ['/bin/sh', ['-c', INSTALL_SCRIPT, SCRIPT_NAME, String(appPid), debPath, relaunchPath, markerPath]];
}

/** Starts the installer fully detached (own session, no pipes) so it outlives the app. */
function scheduleDebInstall({ appPid, debPath, relaunchPath, env = process.env, spawn = spawnProcess }) {
    const markerPath = installMarkerPath(env);
    const [command, args] = debInstallCommand({ appPid, debPath, relaunchPath, markerPath });
    const child = spawn(command, args, { detached: true, stdio: 'ignore', env });
    child.unref();
    try {
        fs.writeFileSync(markerPath, String(child.pid));
    } catch (error) {
        console.error(`Could not write the update marker ${markerPath}: ${error.message}`, error);
    }
    return child;
}

/**
 * The PID of an installer that is still running, or null. A marker left by an installer that
 * died, or whose PID now belongs to another process, is ignored.
 */
function runningInstaller(markerPath = installMarkerPath()) {
    try {
        const pid = Number(fs.readFileSync(markerPath, 'utf8').trim());
        if (!Number.isInteger(pid) || pid <= 0) return null;
        const argv = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
        return argv.includes(SCRIPT_NAME) ? pid : null;
    } catch {
        return null;
    }
}

/**
 * When an update is being installed, hands this launch to a detached shell that repeats it once
 * the install is done, and returns true: the caller must exit at once, before dpkg replaces its files.
 */
function deferLaunchUntilInstalled({ argv, markerPath = installMarkerPath(), env = process.env, spawn = spawnProcess }) {
    const installer = runningInstaller(markerPath);
    if (installer === null) return false;
    const child = spawn('/bin/sh', ['-c', WAIT_SCRIPT, 'claritard-wait', String(installer), ...argv], { detached: true, stdio: 'ignore', env });
    child.unref();
    return true;
}

module.exports = { isDebInstall, debInstallCommand, scheduleDebInstall, installMarkerPath, runningInstaller, deferLaunchUntilInstalled };
