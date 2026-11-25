// KWin script (Plasma 6) loaded by Claritard's Boundaries: reports which windows are minimized,
// so limits can leave out minimized time. Wayland hides other apps' windows from ordinary clients.
const SERVICE = 'app.claritard.Windows';
const PATH = '/app/claritard/Windows';
const INTERFACE = 'app.claritard.Windows';

function isAppWindow(window) {
    return window.normalWindow || window.dialog;
}

function report(removed) {
    const windows = [];
    for (const window of workspace.windowList()) {
        if (window === removed || !isAppWindow(window)) continue;
        windows.push({
            pid: window.pid || 0,
            appId: String(window.desktopFileName || window.resourceClass || ''),
            minimized: Boolean(window.minimized),
        });
    }
    callDBus(SERVICE, PATH, INTERFACE, 'Windows', JSON.stringify(windows));
}

function watch(window) {
    window.minimizedChanged.connect(() => report(null));
}

workspace.windowList().forEach(watch);
workspace.windowAdded.connect(window => {
    watch(window);
    report(null);
});
workspace.windowRemoved.connect(window => report(window));
report(null);
