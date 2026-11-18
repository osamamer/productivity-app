const { desktopKind } = require('./core/desktop');
const { KWinFocusWatcher } = require('./kwinWatcher');
const { GnomeFocusWatcher } = require('./gnomeWatcher');
const { WaylandIdleMonitor } = require('./waylandIdle');
const { MutterIdleMonitor } = require('./mutterIdle');

/** The focus watcher for this desktop, or null when screen time cannot follow focus here. */
function createFocusWatcher({ paths, onFocus, onTitle, onLockChange }, env = process.env) {
    const handlers = { onFocus, onTitle, onLockChange };
    switch (desktopKind(env)) {
        case 'kde':
            return new KWinFocusWatcher({ scriptFile: paths.kwinScriptFile, ...handlers });
        case 'gnome':
            return new GnomeFocusWatcher({ extensionDir: paths.gnomeExtensionsDir, ...handlers });
        default:
            return null;
    }
}

/** Starts the first idle source this desktop offers; rejects with every reason when none works. */
async function startIdleMonitor(options, env = process.env) {
    const sources = desktopKind(env) === 'gnome' ? [MutterIdleMonitor, WaylandIdleMonitor] : [WaylandIdleMonitor];
    const reasons = [];
    for (const Source of sources) {
        const monitor = new Source(options);
        try {
            await monitor.start();
            return monitor;
        } catch (error) {
            reasons.push(error.message);
        }
    }
    throw new Error(reasons.join(' '));
}

module.exports = { createFocusWatcher, startIdleMonitor };
