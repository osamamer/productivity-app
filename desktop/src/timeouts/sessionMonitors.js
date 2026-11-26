const fs = require('node:fs');
const { appTarget } = require('./core/appTarget');
const { runningProcesses, sameSession } = require('./core/processes');
const {
    targetIdentity, saveAppSession, readAppSession, removeAppSession, listAppSessions, liveAppSession,
} = require('./core/appSessions');
const { countsNow } = require('./core/windows');
const { NO_WINDOW_CONTROL, applyTimeUp } = require('./timeUp');
const { readSession, expireBrowser, hasTimedBrowserTab } = require('./core/browserSession');
const { scheduleCommand, cancelUnit } = require('./core/systemd');
const { appUsageToday } = require('./core/appDailyLimits');
const { addDailyOpen } = require('./core/dailyUsage');

const CHECK_MS = 1000;
const START_WAIT_MS = 60_000;
const START_POLL_MS = 500;
// The backstop timer fires a little after the in-app deadline, which normally wins.
const BACKSTOP_DELAY_SECONDS = 3;
const WARNINGS = [60, 10];
// While an app is paused (minimized), its saved deadline is refreshed this often for a restart.
const PAUSED_SAVE_MS = 30_000;
// Without a window list, a held app is minimized again this often in case it was restored.
const BLIND_MINIMIZE_MS = 5000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Sends the "closes in a minute" and "closes in ten seconds" notifications once each. */
class Warnings {
    constructor({ name, totalSeconds, notify, action = 'close' }) {
        this.name = name;
        this.totalSeconds = totalSeconds;
        this.notify = notify;
        this.verb = action === 'minimize' ? 'minimizes' : 'closes';
        this.sent = new Set();
    }

    check(remainingSeconds) {
        for (const threshold of WARNINGS) {
            if (remainingSeconds > threshold || this.totalSeconds < threshold || this.sent.has(threshold)) continue;
            this.sent.add(threshold);
            this.notify({
                title: `${this.name} ${this.verb} soon`,
                body: `${this.name} ${this.verb} in ${threshold} seconds.`,
                tag: `claritard-timeout-${this.name}-${threshold}`,
                targetUrl: null,
            });
        }
    }
}

/**
 * Ends timed app sessions when their time is up. One session per program: a second launcher
 * alias for a program that is already being timed does not restart its clock, and neither does
 * closing the app and opening it again before the deadline.
 *
 * A session whose rule leaves out minimized time (`countMinimized: false`) pauses while none of
 * the app's windows is on screen. One whose rule minimizes instead of closing (`onTimeUp`) is
 * then held: its windows are minimized again whenever they are restored, until the app quits or
 * is opened again through its launcher, which starts a new session.
 *
 * A session never outlasts the app's daily limit: with 15 minutes left today, a 30 minute
 * auto-close starts at 15.
 */
class AppSessionMonitor {
    constructor({
        paths, command, popups, notify, appearance, onChange, windows = NO_WINDOW_CONTROL,
        backstop = { schedule: scheduleCommand, cancel: cancelUnit },
    }) {
        this.paths = paths;
        this.command = command;
        this.backstop = backstop;
        this.popups = popups;
        this.notify = notify;
        this.appearance = appearance;
        this.onChange = onChange;
        this.windows = windows;
        this.active = new Map();
        this.holds = new Map();
    }

    get busy() {
        return this.active.size > 0 || this.holds.size > 0;
    }

    /**
     * The session being watched for the program with `identity`, for the Boundaries page:
     * `{ deadline, totalSeconds, state }` with state 'running', 'paused' (minimized) or 'closed'
     * (the app quit before its deadline), or null.
     */
    status(identity) {
        const live = this.active.get(identity);
        if (!live?.session) return null;
        return { deadline: live.session.deadline, totalSeconds: live.session.totalSeconds, state: live.state };
    }

    /**
     * True when `entry`'s app still has time left from an earlier open, so it may open again
     * without a countdown. Makes sure that session is being watched.
     */
    hasTimeLeft(entry) {
        if (!entry.closeAfterSeconds) return false;
        const target = appTarget(fs.readFileSync(entry.backup, 'utf8'));
        if (!liveAppSession(this.paths, targetIdentity(target))) return false;
        void this.resume();
        return true;
    }

    /** Waits for the launched app to appear, then times it. */
    async start(entry) {
        if (!entry.closeAfterSeconds) return;
        const target = appTarget(fs.readFileSync(entry.backup, 'utf8'));
        const identity = targetIdentity(target);
        this.release(identity);
        if (this.active.has(identity)) return;
        const live = { session: null, state: 'starting' };
        this.active.set(identity, live);
        this.onChange();
        try {
            let processes = [];
            for (let waited = 0; waited < START_WAIT_MS && !processes.length; waited += START_POLL_MS) {
                processes = runningProcesses(target);
                if (!processes.length) await sleep(START_POLL_MS);
            }
            if (!processes.length) return;
            const seconds = this.sessionSeconds(entry);
            const session = {
                id: `${identity}-${Date.now()}`,
                identity,
                name: entry.name,
                target,
                processes,
                totalSeconds: seconds,
                deadline: Date.now() + seconds * 1000,
                countMinimized: entry.countMinimized !== false,
                onTimeUp: entry.onTimeUp ?? 'close',
            };
            this.countOpen(identity);
            this.scheduleBackstop(session);
            await this.watch(session, live);
        } catch (error) {
            console.error(`Could not time ${entry.name}:`, error);
        } finally {
            this.active.delete(identity);
            this.onChange();
        }
    }

    /** The auto-close time, cut short by what is left of the app's daily limit. */
    sessionSeconds(entry) {
        if (!entry.dailyLimitSeconds) return entry.closeAfterSeconds;
        try {
            const left = appUsageToday(this.paths, entry).leftSeconds;
            return Math.max(1, Math.ceil(Math.min(entry.closeAfterSeconds, left)));
        } catch (error) {
            console.error(`Could not read today's time for ${entry.name}:`, error);
            return entry.closeAfterSeconds;
        }
    }

    countOpen(identity) {
        try {
            addDailyOpen(this.paths, 'apps', identity);
        } catch (error) {
            console.error('Could not count an app session:', error);
        }
    }

    /** Picks up sessions saved before Claritard last quit; ends any whose time already ran out. */
    async resume() {
        for (const session of listAppSessions(this.paths)) {
            if (session.deadline <= Date.now()) {
                await this.expire(session.id);
                continue;
            }
            const identity = session.identity ?? targetIdentity(session.target);
            if (this.active.has(identity)) continue;
            const live = { session, state: 'running' };
            this.active.set(identity, live);
            this.onChange();
            void this.watch(session, live).finally(() => {
                this.active.delete(identity);
                this.onChange();
            });
        }
    }

    /**
     * Ends saved session `id` if its time is up; used by the backstop timer and on resume. A
     * session that is being watched is left to its watcher.
     */
    async expire(id) {
        const session = readAppSession(this.paths, id);
        if (!session || session.deadline > Date.now()) return false;
        if (this.active.has(session.identity ?? targetIdentity(session.target))) return false;
        if (sameSession(session.target, session.processes, runningProcesses(session.target))) {
            await this.timeUp(session);
        }
        removeAppSession(this.paths, id);
        return true;
    }

    /**
     * The systemd timer that ends the session if Claritard is not running at its deadline.
     * Rescheduled whenever a pause moves the deadline.
     */
    scheduleBackstop(session) {
        this.cancelBackstop(session);
        session.backstopUnit = `claritard-app-expire-${session.id}-${Date.now()}`;
        saveAppSession(this.paths, session);
        void this.backstop.schedule({
            unit: session.backstopUnit,
            seconds: (session.deadline - Date.now()) / 1000 + BACKSTOP_DELAY_SECONDS,
            command: [...this.command, `--timeout-expire-app=${session.id}`],
            description: `Claritard ends ${session.name}'s time when it is up`,
        });
    }

    cancelBackstop(session) {
        this.backstop.cancel(session.backstopUnit ?? `claritard-app-expire-${session.id}`);
    }

    /**
     * Follows `session` until its deadline. While the app is closed the session stays saved and
     * the "closes in" countdown is hidden; if the app runs again before the deadline its new
     * processes take over the session, and they are the ones ended when time is up.
     */
    async watch(session, live = {}) {
        live.session = session;
        const warnings = new Warnings({
            name: session.name, totalSeconds: session.totalSeconds, notify: this.notify, action: session.onTimeUp,
        });
        let shown = false;
        let pausedSince = null;
        let lastSaved = 0;
        let last = Date.now();
        try {
            for (;;) {
                const now = Date.now();
                const running = runningProcesses(session.target);
                const same = sameSession(session.target, session.processes, running);
                if (same && !countsNow(session, this.windows.isShowing(session.target, session.processes))) {
                    live.state = 'paused';
                    session.deadline += now - last;
                    last = now;
                    if (pausedSince === null) {
                        pausedSince = now;
                        this.cancelBackstop(session);
                        this.popups.close(session.id);
                        shown = false;
                    }
                    if (now - lastSaved >= PAUSED_SAVE_MS) {
                        saveAppSession(this.paths, session);
                        lastSaved = now;
                    }
                    await sleep(CHECK_MS);
                    continue;
                }
                last = now;
                if (pausedSince !== null) {
                    pausedSince = null;
                    this.scheduleBackstop(session);
                }
                const remaining = Math.max(0, (session.deadline - now) / 1000);
                live.state = same || running.length ? 'running' : 'closed';
                if (same) {
                    this.showCountdown(session);
                    shown = true;
                    warnings.check(remaining);
                    if (remaining <= 0) break;
                } else if (remaining <= 0) {
                    this.cancelBackstop(session);
                    return;
                } else if (running.length) {
                    session.processes = running;
                    saveAppSession(this.paths, session);
                    continue;
                } else if (shown) {
                    this.popups.close(session.id);
                    shown = false;
                }
                await sleep(Math.min(CHECK_MS, remaining * 1000));
            }
            this.popups.close(session.id);
            await this.timeUp(session);
        } finally {
            this.popups.close(session.id);
            removeAppSession(this.paths, session.id);
        }
    }

    async timeUp(session) {
        const result = await applyTimeUp({
            windows: this.windows, target: session.target, processes: session.processes, onTimeUp: session.onTimeUp,
        });
        if (result === 'minimized') void this.hold(session);
    }

    /** Keeps a minimized session's windows minimized while the same processes run. */
    async hold(session) {
        const identity = session.identity ?? targetIdentity(session.target);
        if (this.holds.has(identity)) return;
        const hold = { released: false };
        this.holds.set(identity, hold);
        this.onChange();
        let lastMinimized = Date.now();
        try {
            while (!hold.released && sameSession(session.target, session.processes, runningProcesses(session.target))) {
                const showing = this.windows.isShowing(session.target, session.processes);
                if (showing === true || (showing === null && Date.now() - lastMinimized >= BLIND_MINIMIZE_MS)) {
                    await this.windows.minimize(session.target, session.processes);
                    lastMinimized = Date.now();
                }
                await sleep(CHECK_MS);
            }
        } finally {
            if (this.holds.get(identity) === hold) this.holds.delete(identity);
            this.onChange();
        }
    }

    /** Stops holding a program minimized, because it was opened again through its launcher. */
    release(identity) {
        const hold = this.holds.get(identity);
        if (!hold) return;
        hold.released = true;
        this.holds.delete(identity);
    }

    showCountdown(session) {
        this.popups.show(session.id, {
            name: session.name,
            deadline: session.deadline,
            totalSeconds: session.totalSeconds,
            appearance: this.appearance(),
            action: session.onTimeUp,
        });
    }
}

/**
 * Shows the Firefox countdown while a URL timer session runs and closes Firefox at its end.
 * The session file is shared with the native host, so this polls it.
 */
class BrowserSessionMonitor {
    constructor({ paths, popups, notify, appearance, onChange }) {
        this.paths = paths;
        this.popups = popups;
        this.notify = notify;
        this.appearance = appearance;
        this.onChange = onChange;
        this.current = null;
        this.expiring = false;
        this.timer = null;
    }

    get busy() {
        return this.current !== null || this.expiring;
    }

    start() {
        if (this.timer) return;
        this.check();
        this.timer = setInterval(() => this.check(), CHECK_MS);
    }

    check() {
        const session = readSession(this.paths);
        // A daily limit can bring the deadline forward; show the new one.
        const changed = this.current && (session?.id !== this.current.id || session.deadline !== this.current.deadline);
        if (!session || changed) this.stopShowing();
        if (!session) return;
        const remaining = (session.deadline - Date.now() / 1000);
        if (remaining <= 0) {
            void this.expire(session.id);
            return;
        }
        if (!this.current) {
            const totalSeconds = Math.max(1, Math.round(session.deadline - (session.startedAt ?? Date.now() / 1000)));
            this.current = {
                id: session.id,
                deadline: session.deadline,
                key: null,
                shown: false,
                totalSeconds,
                warnings: new Warnings({ name: 'Firefox', totalSeconds: Infinity, notify: this.notify }),
            };
            this.onChange();
        }
        const visible = hasTimedBrowserTab(this.paths, session.id)
            && runningProcesses({ ...session.target, anyProfile: true }).length > 0;
        if (visible && !this.current.shown) {
            // A popup may still be closing when a tab reopens.
            this.current.key = `browser-${session.id}-${session.deadline}-${Date.now()}`;
            this.popups.show(this.current.key, {
                name: 'Firefox',
                deadline: session.deadline * 1000,
                totalSeconds: this.current.totalSeconds,
                appearance: this.appearance(),
            });
        } else if (!visible && this.current.shown) {
            this.popups.close(this.current.key);
        }
        this.current.shown = visible;
        if (visible) this.current.warnings.check(remaining);
    }

    stopShowing() {
        if (!this.current) return;
        if (this.current.key) this.popups.close(this.current.key);
        this.current = null;
        this.onChange();
    }

    async expire(id) {
        if (this.expiring) return;
        this.expiring = true;
        this.stopShowing();
        try {
            await expireBrowser(this.paths, id);
        } catch (error) {
            console.error('Could not close Firefox when its URL timer ended:', error);
        } finally {
            this.expiring = false;
            this.onChange();
        }
    }
}

module.exports = { AppSessionMonitor, BrowserSessionMonitor, Warnings };
