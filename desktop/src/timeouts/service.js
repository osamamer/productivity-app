const { dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { timeoutPaths } = require('./core/paths');
const { appSettings, urlSettings } = require('./core/config');
const { normalizeUrl } = require('./core/urls');
const { Launchers, OWN_DESKTOP_IDS } = require('./core/launchers');
const { installedLaunchers } = require('./core/installedApps');
const { iconDataUrl } = require('./core/icons');
const { launchOriginal, spawnDetached } = require('./core/launchOriginal');
const { expireAppSession } = require('./core/appSessions');
const { activeSession, expireBrowser } = require('./core/browserSession');
const { installBrowserHost, refreshBrowserHost, isBrowserHostInstalled } = require('./browserHost');
const { CountdownWindow, ClosingPopups, installCountdownIpc } = require('./windows');
const { AppSessionMonitor, BrowserSessionMonitor } = require('./sessionMonitors');

const MAX_DELAY_SECONDS = 86400;
const APPEARANCE_KEYS = ['background', 'paper', 'text', 'textSecondary', 'primary', 'onPrimary'];
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;

/** Keeps only the theme colors the timeout windows use. */
function sanitizeAppearance(input) {
    if (!input || typeof input !== 'object') return null;
    const appearance = { mode: input.mode === 'light' ? 'light' : 'dark' };
    for (const key of APPEARANCE_KEYS) {
        if (typeof input[key] === 'string' && COLOR.test(input[key])) appearance[key] = input[key];
    }
    return appearance;
}

/**
 * App and Firefox URL timeouts: delayed launches, auto-closing apps, and the settings the web
 * app's Boundaries page edits. Works the same in local and cloud mode, because it only touches
 * this computer.
 */
class TimeoutService {
    constructor({ command, extensionDir, notify, onIdleChange }) {
        this.paths = timeoutPaths();
        this.command = command;
        this.extensionDir = extensionDir;
        this.notify = notify;
        this.onIdleChange = onIdleChange;
        this.launchers = new Launchers({ paths: this.paths, selfCommand: command });
        this.countdowns = new Map();
        this.iconCache = new Map();
        this.popups = new ClosingPopups();
        const shared = {
            paths: this.paths,
            popups: this.popups,
            notify,
            appearance: () => this.appearance(),
            onChange: () => this.onIdleChange(),
        };
        this.appSessions = new AppSessionMonitor({ ...shared, command });
        this.browserSessions = new BrowserSessionMonitor(shared);
        installCountdownIpc(sender => [...this.countdowns.values()].find(countdown => countdown.webContents === sender));
    }

    get busy() {
        return this.countdowns.size > 0 || this.appSessions.busy || this.browserSessions.busy;
    }

    /** Starts enforcement that must run whenever Claritard is running. */
    start() {
        fs.mkdirSync(this.paths.stateDir, { recursive: true });
        try {
            this.launchers.repair();
            refreshBrowserHost(this.paths, this.command);
        } catch (error) {
            console.error('Could not refresh the app timeout launchers:', error);
        }
        void this.appSessions.resume();
        this.browserSessions.start();
    }

    appearance() {
        try {
            return this.launchers.load().appearance ?? null;
        } catch (error) {
            console.error('Could not read the timeout appearance:', error);
            return null;
        }
    }

    async handleCommand(command) {
        try {
            if (command.type === 'launch') this.launch(command);
            else if (command.type === 'run') this.run(command);
            else if (command.type === 'expire-app') await expireAppSession(this.paths, command.sessionId);
            else if (command.type === 'expire-browser') await expireBrowser(this.paths, command.sessionId);
            else if (command.type === 'install-browser-host') installBrowserHost(this.paths, this.command);
            // 'watch' needs nothing more: start() already watches the Firefox session.
        } catch (error) {
            console.error(`The ${command.type} timeout command failed:`, error);
            dialog.showErrorBox('Claritard', error.message);
        } finally {
            this.onIdleChange();
        }
    }

    openCountdown(key, options) {
        const existing = this.countdowns.get(key);
        if (existing) {
            existing.focus();
            return;
        }
        const countdown = new CountdownWindow({
            ...options,
            appearance: this.appearance(),
            onClosed: () => {
                this.countdowns.delete(key);
                this.onIdleChange();
            },
        });
        this.countdowns.set(key, countdown);
        this.onIdleChange();
    }

    launch({ appId, action, uris }) {
        const entry = this.launchers.load().apps[appId];
        if (!entry) throw new Error('This application no longer has a configured delay. Open its launcher again.');
        if (this.appSessions.hasTimeLeft(entry)) {
            launchOriginal(entry.backup, { uris, action });
            return;
        }
        this.openCountdown(`launch:${appId}`, {
            name: entry.name,
            seconds: entry.delaySeconds,
            message: entry.message,
            autoOpen: entry.autoOpen,
            onOpen: () => {
                try {
                    launchOriginal(entry.backup, { uris, action });
                    void this.appSessions.start(entry);
                } catch (error) {
                    console.error(`Could not open ${entry.name}:`, error);
                    dialog.showErrorBox('Claritard', error.message);
                }
            },
        });
    }

    /** `claritard --timeout-run -- <command>`: a countdown before any command. */
    run({ command, seconds, message, autoOpen }) {
        if (!command.length || !Number.isInteger(seconds) || seconds < 0 || seconds > MAX_DELAY_SECONDS) {
            throw new Error('Provide a command and a delay between 0 and 86400 seconds.');
        }
        this.openCountdown(`run:${JSON.stringify(command)}`, {
            name: path.basename(command[0]),
            seconds,
            message,
            autoOpen,
            onOpen: () => spawnDetached(command),
        });
    }

    // ---- What the Boundaries page asks for ----

    icon(name) {
        if (!this.iconCache.has(name)) this.iconCache.set(name, iconDataUrl(name));
        return this.iconCache.get(name);
    }

    appGroups(config) {
        const launchers = installedLaunchers();
        const shown = [...launchers.values()].filter(launcher =>
            !OWN_DESKTOP_IDS.has(launcher.id) && (launcher.visible || config.apps[launcher.id]));
        return this.launchers.groupedApps(shown, config);
    }

    getState() {
        const config = this.launchers.load();
        const apps = this.appGroups(config).map(({ representative, members }) => {
            const entry = config.apps[representative.id] ?? null;
            return {
                id: representative.id,
                name: representative.name,
                icon: this.icon(representative.icon),
                aliases: members.map(member => member.id),
                settings: entry && {
                    delaySeconds: entry.delaySeconds,
                    closeAfterSeconds: entry.closeAfterSeconds,
                    autoOpen: entry.autoOpen,
                    message: entry.message,
                },
            };
        });
        const urls = Object.entries(config.urls)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([url, rule]) => ({ url, ...rule }));
        const session = activeSession(this.paths);
        return {
            apps,
            urls,
            browser: {
                hostInstalled: isBrowserHostInstalled(this.paths),
                extensionDir: this.extensionDir,
                sessionDeadline: session ? Math.round(session.deadline * 1000) : null,
                unlockedUrls: session ? session.rules : [],
            },
        };
    }

    groupMembers(appId) {
        const config = this.launchers.load();
        const group = this.appGroups(config).find(candidate => candidate.representative.id === appId);
        if (!group) throw new Error('That app is no longer installed.');
        return group.members.map(({ id, file }) => ({ id, file }));
    }

    lockReason(appId) {
        const [first] = this.groupMembers(appId);
        return this.launchers.lockReason(first.id, first.file);
    }

    saveApp(appId, settings) {
        this.launchers.configureGroup(this.groupMembers(appId), appSettings(settings));
    }

    removeApp(appId) {
        this.launchers.configureGroup(this.groupMembers(appId), null);
    }

    saveUrl(previousUrl, url, settings) {
        const config = this.launchers.load();
        const key = normalizeUrl(url);
        if (previousUrl && previousUrl !== key) delete config.urls[previousUrl];
        config.urls[key] = urlSettings(settings);
        this.launchers.save(config);
        return key;
    }

    removeUrl(url) {
        const config = this.launchers.load();
        delete config.urls[url];
        this.launchers.save(config);
    }

    installBrowserHost() {
        installBrowserHost(this.paths, this.command);
    }

    async openExtensionFolder() {
        const failure = await shell.openPath(this.extensionDir);
        if (failure) throw new Error(failure);
    }

    setAppearance(input) {
        const appearance = sanitizeAppearance(input);
        if (!appearance) return;
        const config = this.launchers.load();
        if (JSON.stringify(config.appearance) === JSON.stringify(appearance)) return;
        config.appearance = appearance;
        this.launchers.save(config);
    }
}

module.exports = { TimeoutService };
