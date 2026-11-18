const { powerMonitor } = require('electron');
const { usagePaths } = require('./core/paths');
const { UsageStore } = require('./core/store');
const { INITIAL_STATE, reduce } = require('./core/tracker');
const { readUsageSettings, writeUsageSettings } = require('./core/settings');
const { isAutostartEnabled, setAutostart } = require('./core/autostart');
const { describeApp } = require('./core/apps');
const { mergeIntervals, dropBriefVisits } = require('./core/segments');
const { installedLaunchers } = require('../timeouts/core/installedApps');
const { iconDataUrl } = require('../timeouts/core/icons');
const { UNSUPPORTED_DESKTOP } = require('./core/desktop');
const { createFocusWatcher, startIdleMonitor } = require('./desktopBackends');

const CHECKPOINT_MS = 60_000;
const IDLE_AFTER_MS = 3 * 60_000;
const MAX_RANGE_MS = 8 * 24 * 3600_000;
const APP_CACHE_MS = 10 * 60_000;
const BRIEF_VISIT_MS = 5000;

/**
 * Desktop screen time: which app has focus, minus idle and locked time, written to day files
 * on this computer only. Works the same in local and cloud mode.
 *
 * Not thread-safe in any meaningful sense, but Electron's main process is single-threaded;
 * every event goes through `dispatch`, which is synchronous.
 */
class UsageService {
    constructor({ command }) {
        this.paths = usagePaths();
        this.command = command;
        this.store = new UsageStore(this.paths.daysDir);
        this.state = INITIAL_STATE;
        this.tracking = false;
        this.trackedSince = null;
        this.unsupportedReason = null;
        this.watcher = null;
        this.idle = null;
        this.checkpointTimer = null;
        this.launchers = null;
        this.launchersLoadedAt = 0;
        this.iconCache = new Map();
        this.onSuspend = () => this.pause();
        this.onResume = () => void this.resume();
        this.recordTitles = true;
    }

    settings() {
        return readUsageSettings(this.paths.settingsFile);
    }

    getStatus() {
        return {
            settings: { ...this.settings(), startAtLogin: isAutostartEnabled(this.paths.autostartFile) },
            supported: this.unsupportedReason === null,
            reason: this.unsupportedReason,
            tracking: this.tracking,
        };
    }

    async start() {
        if (this.settings().enabled) await this.startTracking();
    }

    async startTracking() {
        if (this.tracking) return;
        // Taken first, so the first focus report falls inside the tracked span.
        const startedAt = Date.now();
        this.watcher = createFocusWatcher({
            paths: this.paths,
            onFocus: focus => this.dispatch({ type: 'focus', ...focus }),
            onTitle: focus => this.dispatch({ type: 'title', ...focus }),
            onLockChange: locked => this.dispatch({ type: locked ? 'locked' : 'unlocked' }),
        });
        if (!this.watcher) {
            this.unsupportedReason = UNSUPPORTED_DESKTOP;
            return;
        }
        try {
            await this.watcher.start();
        } catch (error) {
            console.error(`Screen time could not start: ${error.message}`, error);
            this.unsupportedReason = error.message;
            await this.watcher.stop().catch(() => {});
            this.watcher = null;
            return;
        }
        this.unsupportedReason = null;
        this.recordTitles = this.settings().recordTitles;
        try {
            this.idle = await startIdleMonitor({
                timeoutMs: IDLE_AFTER_MS,
                onIdle: idleSince => this.dispatch({ type: 'idle', idleSince }),
                onActive: () => this.dispatch({ type: 'active' }),
            });
        } catch (error) {
            console.error(`Screen time cannot see idle time; only the lock screen will pause it: ${error.message}`, error);
            this.idle = null;
        }
        this.tracking = true;
        this.trackedSince = startedAt;
        this.checkpointTimer = setInterval(() => this.checkpoint(), CHECKPOINT_MS);
        powerMonitor.on('suspend', this.onSuspend);
        powerMonitor.on('resume', this.onResume);
    }

    dispatch(event) {
        const result = reduce(this.state, event, Date.now(), { recordTitles: this.recordTitles });
        this.state = result.state;
        if (result.closed) this.write(() => this.store.appendSegment(result.closed));
    }

    write(action) {
        try {
            action();
        } catch (error) {
            console.error(`Could not save screen time: ${error.message}`, error);
        }
    }

    writeTracked(until) {
        if (this.trackedSince === null || until <= this.trackedSince) return;
        const interval = { start: this.trackedSince, end: until };
        this.write(() => this.store.appendTracked(interval));
        this.trackedSince = until;
    }

    checkpoint() {
        this.dispatch({ type: 'checkpoint' });
        this.writeTracked(Date.now());
    }

    // Asleep is neither app time nor tracked time. The focus is kept, so waking up resumes it.
    pause() {
        if (!this.tracking || this.trackedSince === null) return;
        this.dispatch({ type: 'locked' });
        this.writeTracked(Date.now());
        this.trackedSince = null;
    }

    async resume() {
        if (!this.tracking || this.trackedSince !== null) return;
        this.trackedSince = Date.now();
        // The lock screen usually comes up with suspend; unlocking then reports ActiveChanged.
        if (!(await this.watcher.isLocked())) this.dispatch({ type: 'unlocked' });
    }

    async stopTracking() {
        if (!this.tracking) return;
        this.dispatch({ type: 'stop' });
        this.writeTracked(Date.now());
        this.tracking = false;
        this.trackedSince = null;
        clearInterval(this.checkpointTimer);
        powerMonitor.off('suspend', this.onSuspend);
        powerMonitor.off('resume', this.onResume);
        this.idle?.stop();
        this.idle = null;
        await this.watcher?.stop();
        this.watcher = null;
    }

    async saveSettings(input) {
        const settings = {
            enabled: Boolean(input?.enabled),
            recordTitles: Boolean(input?.recordTitles),
            startAtLogin: Boolean(input?.startAtLogin),
        };
        writeUsageSettings(this.paths.settingsFile, settings);
        setAutostart(this.paths.autostartFile, settings.startAtLogin, this.command);
        if (settings.enabled) {
            // Restarting applies a changed title setting to the open segment too.
            await this.stopTracking();
            await this.startTracking();
        } else {
            await this.stopTracking();
            this.unsupportedReason = null;
        }
        return this.getStatus();
    }

    /** Segments and tracked spans in [from, to), including what is happening right now. */
    getRange(from, to) {
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > MAX_RANGE_MS) {
            throw new Error('That time range cannot be shown.');
        }
        const now = Date.now();
        const { segments, tracked } = this.store.readRange(from, to);
        const current = this.state.current;
        if (current && current.start < to && now > from) {
            segments.push({ ...current, start: Math.max(current.start, from), end: Math.min(now, to) });
        }
        if (this.trackedSince !== null && this.trackedSince < to && now > from) {
            tracked.push({ start: Math.max(this.trackedSince, from), end: Math.min(now, to) });
        }
        // Filtered when read, not when recorded, so the threshold can change without losing data.
        const visits = dropBriefVisits(segments.filter(segment => segment.end > segment.start), BRIEF_VISIT_MS);
        return {
            segments: visits,
            apps: this.describeApps(new Set(visits.map(segment => segment.appId))),
            tracked: mergeIntervals(tracked),
        };
    }

    describeApps(appIds) {
        if (!this.launchers || Date.now() - this.launchersLoadedAt > APP_CACHE_MS) {
            this.launchers = installedLaunchers();
            this.launchersLoadedAt = Date.now();
        }
        const iconFor = name => {
            if (!this.iconCache.has(name)) this.iconCache.set(name, iconDataUrl(name));
            return this.iconCache.get(name);
        };
        return Object.fromEntries([...appIds].map(id => [id, describeApp(id, this.launchers, iconFor)]));
    }
}

module.exports = { UsageService };
