/**
 * What the compositor reports about open windows, `[{ pid, appId, minimized }]`, matched to a
 * running program. Pure, so it can be tested without a desktop.
 */

/** The windows that belong to `processes` of `target`. Flatpak windows match by app ID too. */
function programWindows(snapshot, target, processes) {
    const pids = new Set(processes.map(proc => proc.pid));
    return snapshot.filter(window => pids.has(window.pid) || (target.flatpak && window.appId === target.flatpak));
}

/**
 * True when one of the program's windows is on screen (not minimized), false when it only has
 * minimized windows or none (hidden to the tray), and null when the windows are unknown.
 */
function isShowing(snapshot, target, processes) {
    if (!snapshot) return null;
    return programWindows(snapshot, target, processes).some(window => !window.minimized);
}

/**
 * Whether time spent now counts toward a limit: always, unless the rule leaves out minimized
 * time and the program is known to be out of sight.
 */
function countsNow(rule, showing) {
    return rule.countMinimized !== false || showing !== false;
}

module.exports = { programWindows, isShowing, countsNow };
