const fs = require('node:fs');
const path = require('node:path');
const { MAIN_GROUP, parseDesktopEntry, getString, getBoolean } = require('./desktopEntry');
const { which } = require('./appTarget');

/** The `applications` directories in XDG precedence order (user first). */
function applicationDirs(env = process.env) {
    const home = env.HOME;
    const dataHome = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    const dataDirs = (env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(Boolean);
    // Flatpak exports are normally on XDG_DATA_DIRS already; add them in case the session lacks them.
    const flatpak = [path.join(dataHome, 'flatpak', 'exports', 'share'), '/var/lib/flatpak/exports/share'];
    const unique = [];
    for (const dir of [dataHome, ...dataDirs, ...flatpak]) {
        const applications = path.join(dir, 'applications');
        if (!unique.includes(applications)) unique.push(applications);
    }
    return unique;
}

function walkDesktopFiles(root, dir = root, found = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return found;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkDesktopFiles(root, full, found);
        else if (entry.name.endsWith('.desktop')) found.push({ id: path.relative(root, full).split(path.sep).join('-'), file: full });
    }
    return found;
}

function currentDesktops(env) {
    return (env.XDG_CURRENT_DESKTOP || '').split(':').filter(Boolean).map(name => name.toLowerCase());
}

function listed(value) {
    return (value ?? '').split(';').map(item => item.trim().toLowerCase()).filter(Boolean);
}

/** Mirrors GLib's `g_app_info_should_show`: apps a launcher menu would list. */
function shouldShow(entry, env) {
    if (getString(entry, MAIN_GROUP, 'Type') !== 'Application') return false;
    if (getBoolean(entry, MAIN_GROUP, 'NoDisplay') || getBoolean(entry, MAIN_GROUP, 'Hidden')) return false;
    const desktops = currentDesktops(env);
    const onlyShowIn = listed(getString(entry, MAIN_GROUP, 'OnlyShowIn'));
    if (onlyShowIn.length && !onlyShowIn.some(name => desktops.includes(name))) return false;
    if (listed(getString(entry, MAIN_GROUP, 'NotShowIn')).some(name => desktops.includes(name))) return false;
    const tryExec = getString(entry, MAIN_GROUP, 'TryExec');
    if (tryExec && !which(tryExec.trim(), env)) return false;
    return true;
}

function localizedName(entry, env) {
    const locale = (env.LC_ALL || env.LC_MESSAGES || env.LANG || '').split('.')[0];
    const candidates = locale ? [locale, locale.split('_')[0]] : [];
    for (const candidate of candidates) {
        const value = getString(entry, MAIN_GROUP, `Name[${candidate}]`);
        if (value) return value;
    }
    return getString(entry, MAIN_GROUP, 'Name') ?? '';
}

/**
 * Installed launchers by desktop ID. Like GLib, the first directory that has an ID wins, so a
 * user's override in `~/.local/share/applications` hides the system copy. Hidden launchers
 * still occupy their ID; `visible` says whether a menu would show it.
 */
function installedLaunchers(env = process.env) {
    const launchers = new Map();
    for (const root of applicationDirs(env)) {
        for (const { id, file } of walkDesktopFiles(root)) {
            if (launchers.has(id)) continue;
            let text;
            try {
                text = fs.readFileSync(file, 'utf8');
            } catch {
                continue;
            }
            const entry = parseDesktopEntry(text);
            launchers.set(id, {
                id,
                file,
                name: localizedName(entry, env) || id.replace(/\.desktop$/, ''),
                icon: getString(entry, MAIN_GROUP, 'Icon'),
                visible: shouldShow(entry, env),
            });
        }
    }
    return launchers;
}

module.exports = { applicationDirs, installedLaunchers };
