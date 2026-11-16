const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
    MAIN_GROUP, ACTION_PREFIX, parseDesktopEntry, serializeDesktopEntry, groupNames,
    getString, getBoolean, setString, setBoolean, quoteExecArgument,
} = require('./desktopEntry');
const { appTarget } = require('./appTarget');
const { runningProcesses } = require('./processes');
const { loadConfig, saveConfig } = require('./config');

/** Set on every launcher Claritard rewrites, so it never overwrites one changed by someone else. */
const MARKER_KEY = 'X-Claritard-Timeout';
const OWN_DESKTOP_IDS = new Set(['claritard.desktop', 'app-timeout.desktop']);

function isClaritardLauncher(text) {
    try {
        return getBoolean(parseDesktopEntry(text), MAIN_GROUP, MARKER_KEY);
    } catch {
        return false;
    }
}

function hasForeignWrapper(text) {
    return /app-timeout["']?\s+launch\b/.test(text) || text.includes('spotify-timeout');
}

function wrapperExec(selfCommand, appId, action) {
    const parts = [...selfCommand.map(quoteExecArgument), quoteExecArgument(`--timeout-launch=${appId}`)];
    if (action) parts.push(quoteExecArgument(`--timeout-action=${action}`));
    parts.push('--', '%U');
    return parts.join(' ');
}

/** Points every Exec line of a launcher at Claritard's countdown instead of the app itself. */
function wrapLauncher(originalText, appId, selfCommand) {
    const entry = parseDesktopEntry(originalText);
    // Disable D-Bus activation so the desktop actually runs our Exec line.
    setBoolean(entry, MAIN_GROUP, 'DBusActivatable', false);
    setBoolean(entry, MAIN_GROUP, 'Terminal', false);
    setBoolean(entry, MAIN_GROUP, 'StartupNotify', false);
    setBoolean(entry, MAIN_GROUP, MARKER_KEY, true);
    for (const group of groupNames(entry)) {
        if (group !== MAIN_GROUP && !group.startsWith(ACTION_PREFIX)) continue;
        const action = group === MAIN_GROUP ? null : group.slice(ACTION_PREFIX.length);
        setString(entry, group, 'Exec', wrapperExec(selfCommand, appId, action));
    }
    return serializeDesktopEntry(entry);
}

function readText(file) {
    return fs.readFileSync(file, 'utf8');
}

function validDesktopId(appId) {
    return typeof appId === 'string' && path.basename(appId) === appId && appId.endsWith('.desktop');
}

/**
 * Edits launchers for one user. Every change keeps a backup of the original launcher, so turning
 * a delay off restores it exactly.
 *
 * Limitation: only launchers are delayed. Apps that are already running, started from a
 * terminal, or opened by another app through D-Bus bypass the countdown.
 */
class Launchers {
    constructor({ paths, selfCommand }) {
        this.paths = paths;
        this.selfCommand = selfCommand;
    }

    load() {
        return loadConfig(this.paths.configFile);
    }

    save(config) {
        saveConfig(this.paths.configFile, config);
    }

    refreshDatabase() {
        execFile('update-desktop-database', [this.paths.applicationsDir], error => {
            if (error && error.code !== 'ENOENT') console.error('update-desktop-database failed:', error);
        });
    }

    /** Throws while the app is running, because changing its launcher then would confuse its session. */
    ensureClosed(entry) {
        if (runningProcesses(appTarget(readText(entry.backup))).length) {
            throw new Error('Close this app completely before changing its settings.');
        }
    }

    /** Null when the app can be changed now, otherwise why not. */
    lockReason(appId, sourceFile) {
        const entry = this.load().apps[appId] ?? { backup: sourceFile };
        try {
            this.ensureClosed(entry);
            return null;
        } catch (error) {
            return error.message;
        }
    }

    checkUntouched(appId) {
        const destination = path.join(this.paths.applicationsDir, appId);
        if (fs.existsSync(destination) && !isClaritardLauncher(readText(destination))) {
            throw new Error('The launcher was changed elsewhere; refusing to overwrite it.');
        }
    }

    enable(config, appId, sourceFile, settings) {
        if (!validDesktopId(appId)) throw new Error('Invalid desktop application ID.');
        const previous = config.apps[appId];
        this.ensureClosed(previous ?? { backup: sourceFile });
        const destination = path.join(this.paths.applicationsDir, appId);
        let backup;
        let hadLocal;
        if (previous) {
            this.checkUntouched(appId);
            ({ backup, hadLocal } = previous);
        } else {
            const original = readText(sourceFile);
            if (isClaritardLauncher(original) || hasForeignWrapper(original)) {
                throw new Error('This launcher already has a timeout wrapper. Turn the delay off in App Timeout first.');
            }
            backup = path.join(this.paths.originalsDir, appId);
            fs.mkdirSync(this.paths.originalsDir, { recursive: true });
            fs.writeFileSync(backup, original);
            hadLocal = fs.existsSync(destination);
        }
        const original = readText(backup);
        const name = getString(parseDesktopEntry(original), MAIN_GROUP, 'Name') ?? appId;
        config.apps[appId] = { name, backup, hadLocal, ...settings };
        fs.mkdirSync(this.paths.applicationsDir, { recursive: true });
        this.save(config);
        fs.writeFileSync(destination, wrapLauncher(original, appId, this.selfCommand));
    }

    disable(config, appId) {
        const entry = config.apps[appId];
        if (!entry) return;
        this.ensureClosed(entry);
        this.checkUntouched(appId);
        const destination = path.join(this.paths.applicationsDir, appId);
        if (entry.hadLocal) fs.writeFileSync(destination, readText(entry.backup));
        else fs.rmSync(destination, { force: true });
        delete config.apps[appId];
        this.save(config);
    }

    /**
     * Applies `settings` to every alias of one app (or removes the delay when `settings` is
     * null). All aliases are validated before any is changed, so a group is never left half done.
     */
    configureGroup(members, settings) {
        const config = this.load();
        for (const { id, file } of members) {
            const entry = config.apps[id];
            this.ensureClosed(entry ?? { backup: file });
            if (entry) this.checkUntouched(id);
        }
        for (const { id, file } of members) {
            if (settings) this.enable(config, id, file, settings);
            else this.disable(config, id);
        }
        this.refreshDatabase();
    }

    /**
     * Groups launchers that start the same program (e.g. a native and a Flatpak Spotify launcher
     * stay separate, but two IDs for the same Flatpak are one app), so a delay covers every alias.
     */
    groupedApps(launchers, config = this.load()) {
        const groups = new Map();
        for (const launcher of launchers) {
            const entry = config.apps[launcher.id] ?? { backup: launcher.file };
            let key;
            try {
                const original = readText(entry.backup);
                const target = appTarget(original);
                // Native apps may share an executable but have distinct profiles or modes.
                key = target.flatpak ? `flatpak:${target.flatpak}` : `exec:${getString(parseDesktopEntry(original), MAIN_GROUP, 'Exec')}`;
            } catch {
                key = `desktop:${launcher.id}`;
            }
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(launcher);
        }
        const result = [];
        for (const [key, members] of groups) {
            const canonical = key.startsWith('flatpak:') ? `${key.slice('flatpak:'.length)}.desktop` : '';
            members.sort((a, b) => Number(!config.apps[a.id]) - Number(!config.apps[b.id])
                || Number(a.id !== canonical) - Number(b.id !== canonical)
                || a.id.localeCompare(b.id));
            result.push({ representative: members[0], members });
        }
        return result.sort((a, b) => a.representative.name.localeCompare(b.representative.name, undefined, { sensitivity: 'base' }));
    }

    /** Re-points Claritard's launchers when the app moved (e.g. a new AppImage location). */
    repair() {
        const config = this.load();
        let changed = false;
        for (const appId of Object.keys(config.apps)) {
            const destination = path.join(this.paths.applicationsDir, appId);
            let current;
            try {
                current = readText(destination);
            } catch {
                continue;
            }
            if (!isClaritardLauncher(current)) continue;
            const wrapped = wrapLauncher(readText(config.apps[appId].backup), appId, this.selfCommand);
            if (wrapped === current) continue;
            fs.writeFileSync(destination, wrapped);
            changed = true;
        }
        if (changed) this.refreshDatabase();
    }
}

module.exports = { Launchers, OWN_DESKTOP_IDS, MARKER_KEY, wrapLauncher, isClaritardLauncher, hasForeignWrapper };
