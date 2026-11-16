/**
 * The command-line entry points that launchers, the Firefox native host and systemd timers use
 * to reach Claritard. Returns null when argv holds none, i.e. a normal app launch.
 *
 *   --timeout-launch=<desktop-id> [--timeout-action=<action>] -- [uris…]
 *   --timeout-run [--timeout-seconds=N] [--timeout-message=M] [--timeout-confirm] -- <command…>
 *   --timeout-watch
 *   --timeout-expire-app=<session-id>
 *   --timeout-expire-browser=<session-id>
 *   --timeout-install-browser-host
 *
 * Values are joined to their switch with "=" because Chromium moves switches ahead of other
 * arguments, which would separate "--switch value".
 */
function switchValue(argv, name) {
    const prefix = `--${name}=`;
    const separator = argv.indexOf('--');
    const switches = separator >= 0 ? argv.slice(0, separator) : argv;
    const found = switches.find(arg => arg.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
}

function hasSwitch(argv, name) {
    const separator = argv.indexOf('--');
    return (separator >= 0 ? argv.slice(0, separator) : argv).includes(`--${name}`);
}

function afterSeparator(argv) {
    const index = argv.indexOf('--');
    return index >= 0 ? argv.slice(index + 1) : [];
}

function parseTimeoutCommand(argv) {
    const appId = switchValue(argv, 'timeout-launch');
    if (appId) {
        // Chromium may append its own switches to a forwarded command line; no URI starts with "--".
        const uris = afterSeparator(argv).filter(arg => !arg.startsWith('--'));
        return { type: 'launch', appId, action: switchValue(argv, 'timeout-action'), uris };
    }
    if (hasSwitch(argv, 'timeout-run')) {
        return {
            type: 'run',
            command: afterSeparator(argv),
            seconds: Number(switchValue(argv, 'timeout-seconds') ?? 30),
            message: switchValue(argv, 'timeout-message') ?? 'Take a breath.',
            autoOpen: !hasSwitch(argv, 'timeout-confirm'),
        };
    }
    if (hasSwitch(argv, 'timeout-watch')) return { type: 'watch' };
    const app = switchValue(argv, 'timeout-expire-app');
    if (app) return { type: 'expire-app', sessionId: app };
    const browser = switchValue(argv, 'timeout-expire-browser');
    if (browser) return { type: 'expire-browser', sessionId: browser };
    if (hasSwitch(argv, 'timeout-install-browser-host')) return { type: 'install-browser-host' };
    return null;
}

/**
 * How launchers and timers start this copy of Claritard: the AppImage file when running from
 * one (its mount point changes every run), otherwise the executable, plus the app folder when
 * running from source.
 */
function selfCommand({ env = process.env, execPath = process.execPath, isPackaged, appPath }) {
    if (env.APPIMAGE) return [env.APPIMAGE];
    return isPackaged ? [execPath] : [execPath, appPath];
}

module.exports = { parseTimeoutCommand, selfCommand };
