const { execFile } = require('node:child_process');

// The display session, plus the folders Claritard keeps its timeout files in when customized.
const SESSION_ENV = [
    'DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS',
    'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_DATA_DIRS', 'XDG_CURRENT_DESKTOP',
];

function sessionEnvArgs(env) {
    return SESSION_ENV.filter(key => env[key]).map(key => `--setenv=${key}=${env[key]}`);
}

/**
 * Schedules `command` to run in `seconds` with a transient systemd user timer. The timer lives
 * outside Claritard, so a time limit is still enforced if Claritard quits or crashes first.
 * Resolves false where there is no systemd user manager; the in-app timer still applies.
 */
function scheduleCommand({ unit, seconds, command, description, env = process.env }) {
    const args = [
        '--user', '--quiet', '--collect',
        `--unit=${unit}`,
        `--on-active=${Math.max(1, Math.ceil(seconds))}s`,
        '--timer-property=AccuracySec=1s',
        `--description=${description}`,
        ...sessionEnvArgs(env),
        ...command,
    ];
    return new Promise(resolve => {
        execFile('systemd-run', args, error => {
            if (error) console.error(`Could not schedule ${unit} with systemd-run:`, error);
            resolve(!error);
        });
    });
}

/** Starts `command` now as its own systemd user service, detached from the caller. */
function runDetached({ unit, command, description, env = process.env }) {
    const args = ['--user', '--quiet', '--collect', `--unit=${unit}`, '--property=Type=exec', `--description=${description}`, ...sessionEnvArgs(env), ...command];
    return new Promise(resolve => {
        execFile('systemd-run', args, error => resolve(!error));
    });
}

function cancelUnit(unit) {
    execFile('systemctl', ['--user', 'stop', `${unit}.timer`], () => {});
}

module.exports = { scheduleCommand, runDetached, cancelUnit };
