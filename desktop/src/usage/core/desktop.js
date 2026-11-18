/**
 * Which desktop's focus tracking to use, from `XDG_CURRENT_DESKTOP` (a colon-separated list,
 * e.g. `ubuntu:GNOME` or `KDE`). Returns 'kde', 'gnome' or null.
 */
function desktopKind(env = process.env) {
    const names = (env.XDG_CURRENT_DESKTOP || '').toLowerCase().split(':');
    if (names.includes('kde')) return 'kde';
    if (names.includes('gnome')) return 'gnome';
    return null;
}

const UNSUPPORTED_DESKTOP = 'Screen time works on KDE Plasma and GNOME only.';

module.exports = { desktopKind, UNSUPPORTED_DESKTOP };
