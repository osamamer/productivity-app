/**
 * Finds the launcher for an app id KWin reports: the desktop file name without `.desktop`
 * (`org.kde.dolphin`) or, for apps that set none, the window class (`firefox`, `Code`).
 */
function findLauncher(appId, launchers) {
    const exact = launchers.get(`${appId}.desktop`);
    if (exact) return exact;
    const wanted = `${appId.toLowerCase()}.desktop`;
    for (const [id, launcher] of launchers) {
        if (id.toLowerCase() === wanted) return launcher;
    }
    return null;
}

/** A readable name when no launcher is installed: `org.example.notes` becomes `Notes`. */
function fallbackName(appId) {
    const last = appId.split('.').filter(Boolean).pop() || appId;
    return last.charAt(0).toUpperCase() + last.slice(1);
}

function describeApp(appId, launchers, iconFor) {
    const launcher = findLauncher(appId, launchers);
    return {
        id: appId,
        name: launcher?.name || fallbackName(appId),
        icon: launcher?.icon ? iconFor(launcher.icon) : null,
    };
}

module.exports = { describeApp, fallbackName };
