const fs = require('node:fs');
const { appTarget } = require('./core/appTarget');
const { runningProcesses, sameSession, endSession } = require('./core/processes');
const { targetIdentity, saveAppSession, removeAppSession, listAppSessions, expireAppSession } = require('./core/appSessions');
const { readSession, expireBrowser } = require('./core/browserSession');
const { scheduleCommand, cancelUnit } = require('./core/systemd');

const CHECK_MS = 1000;
const START_WAIT_MS = 60_000;
const START_POLL_MS = 500;
// The backstop timer fires a little after the in-app deadline, which normally wins.
const BACKSTOP_DELAY_SECONDS = 3;
const WARNINGS = [60, 10];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Sends the "closes in a minute" and "closes in ten seconds" notifications once each. */
class Warnings {
    constructor({ name, totalSeconds, notify }) {
        this.name = name;
        this.totalSeconds = totalSeconds;
        this.notify = notify;
        this.sent = new Set();
    }

    check(remainingSeconds) {
        for (const threshold of WARNINGS) {
            if (remainingSeconds > threshold || this.totalSeconds < threshold || this.sent.has(threshold)) continue;
            this.sent.add(threshold);
            this.notify({
                title: `${this.name} closes soon`,
                body: `${this.name} will close in ${threshold} seconds.`,
                tag: `claritard-timeout-${this.name}-${threshold}`,
                targetUrl: null,
            });
        }
    }
}

/**
 * Ends timed app sessions when their time is up. One session per program: a second launcher
 * alias for a program that is already being timed does not restart its clock.
 */
class AppSessionMonitor {
    constructor({ paths, command, popups, notify, appearance, onChange }) {
        this.paths = paths;
        this.command = command;
        this.popups = popups;
        this.notify = notify;
        this.appearance = appearance;
        this.onChange = onChange;
        this.active = new Map();
    }

    get busy() {
        return this.active.size > 0;
    }

    /** Waits for the launched app to appear, then times it. */
    async start(entry) {
        if (!entry.closeAfterSeconds) return;
        const target = appTarget(fs.readFileSync(entry.backup, 'utf8'));
        const identity = targetIdentity(target);
        if (this.active.has(identity)) return;
        this.active.set(identity, null);
        this.onChange();
        try {
            let processes = [];
            for (let waited = 0; waited < START_WAIT_MS && !processes.length; waited += START_POLL_MS) {
                processes = runningProcesses(target);
                if (!processes.length) await sleep(START_POLL_MS);
            }
            if (!processes.length) return;
            const session = {
                id: `${identity}-${Date.now()}`,
                identity,
                name: entry.name,
                target,
                processes,
                totalSeconds: entry.closeAfterSeconds,
                deadline: Date.now() + entry.closeAfterSeconds * 1000,
            };
            saveAppSession(this.paths, session);
            void scheduleCommand({
                unit: `claritard-app-expire-${session.id}`,
                seconds: entry.closeAfterSeconds + BACKSTOP_DELAY_SECONDS,
                command: [...this.command, `--timeout-expire-app=${session.id}`],
                description: `Claritard closes ${entry.name} when its time is up`,
            });
            await this.watch(session);
        } catch (error) {
            console.error(`Could not time ${entry.name}:`, error);
        } finally {
            this.active.delete(identity);
            this.onChange();
        }
    }

    /** Picks up sessions saved before Claritard last quit; ends any whose time already ran out. */
    async resume() {
        for (const session of listAppSessions(this.paths)) {
            if (session.deadline <= Date.now()) {
                await expireAppSession(this.paths, session.id);
                continue;
            }
            const identity = session.identity ?? targetIdentity(session.target);
            if (this.active.has(identity)) continue;
            this.active.set(identity, null);
            this.onChange();
            void this.watch(session).finally(() => {
                this.active.delete(identity);
                this.onChange();
            });
        }
    }

    async watch(session) {
        const warnings = new Warnings({ name: session.name, totalSeconds: session.totalSeconds, notify: this.notify });
        this.popups.show(session.id, {
            name: session.name,
            deadline: session.deadline,
            totalSeconds: session.totalSeconds,
            appearance: this.appearance(),
        });
        try {
            for (;;) {
                const remaining = Math.max(0, (session.deadline - Date.now()) / 1000);
                if (!sameSession(session.target, session.processes, runningProcesses(session.target))) {
                    cancelUnit(`claritard-app-expire-${session.id}`);
                    return;
                }
                warnings.check(remaining);
                if (remaining <= 0) break;
                await sleep(Math.min(CHECK_MS, remaining * 1000));
            }
            this.popups.close(session.id);
            await endSession(session.target, session.processes);
        } finally {
            this.popups.close(session.id);
            removeAppSession(this.paths, session.id);
        }
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
        if (!session || (this.current && session.id !== this.current.id)) this.stopShowing();
        if (!session) return;
        const remaining = (session.deadline - Date.now() / 1000);
        if (remaining <= 0) {
            void this.expire(session.id);
            return;
        }
        if (!this.current) {
            const totalSeconds = Math.max(1, Math.round(session.deadline - (session.startedAt ?? Date.now() / 1000)));
            this.current = { id: session.id, warnings: new Warnings({ name: 'Firefox', totalSeconds: Infinity, notify: this.notify }) };
            this.popups.show(`browser-${session.id}`, {
                name: 'Firefox',
                deadline: session.deadline * 1000,
                totalSeconds,
                appearance: this.appearance(),
            });
            this.onChange();
        }
        this.current.warnings.check(remaining);
    }

    stopShowing() {
        if (!this.current) return;
        this.popups.close(`browser-${this.current.id}`);
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

module.exports = { AppSessionMonitor, BrowserSessionMonitor };
