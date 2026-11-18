// KWin script (Plasma 6) loaded by Claritard: reports the focused window over D-Bus.
// Wayland hides other apps' windows from ordinary clients, so only the compositor can tell.
const SERVICE = 'app.claritard.Usage';
const PATH = '/app/claritard/Usage';
const INTERFACE = 'app.claritard.Usage';
let watched = null;

function send(method, window) {
    const appId = window ? String(window.desktopFileName || window.resourceClass || '') : '';
    const title = window ? String(window.caption || '') : '';
    const fullscreen = window ? Boolean(window.fullScreen) : false;
    // A string, because callDBus would send a JS number as a double.
    const pid = window ? String(window.pid || 0) : '0';
    callDBus(SERVICE, PATH, INTERFACE, `${method}WithPid`, appId, title, fullscreen, pid);
}

function titleChanged() {
    send('Title', watched);
}

function unwatch() {
    if (!watched) return;
    try {
        watched.captionChanged.disconnect(titleChanged);
        watched.fullScreenChanged.disconnect(titleChanged);
    } catch (error) {
        // The window may already be gone.
    }
    watched = null;
}

function activated(window) {
    unwatch();
    if (window) {
        watched = window;
        window.captionChanged.connect(titleChanged);
        window.fullScreenChanged.connect(titleChanged);
    }
    send('Focus', window);
}

workspace.windowActivated.connect(activated);
activated(workspace.activeWindow);
