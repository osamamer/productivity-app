const { endSession } = require('./core/processes');

/** Stands in for window control where windows can be neither seen nor minimized. */
const NO_WINDOW_CONTROL = {
    isShowing: () => null,
    minimize: async () => false,
};

/**
 * Ends a program's time: minimizes it when its rule says so and the desktop allows it,
 * otherwise closes it. Resolves 'minimized' or 'closed'.
 */
async function applyTimeUp({ windows, target, processes, onTimeUp }) {
    if (onTimeUp === 'minimize' && await windows.minimize(target, processes)) return 'minimized';
    await endSession(target, processes);
    return 'closed';
}

module.exports = { NO_WINDOW_CONTROL, applyTimeUp };
