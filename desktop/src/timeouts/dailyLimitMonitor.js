const { limitedApps } = require('./core/appDailyLimits');
const { readDailyUsage, addDailyUsage, remainingSeconds, localDate } = require('./core/dailyUsage');
const { runningProcesses } = require('./core/processes');
const { countsNow } = require('./core/windows');
const { Warnings } = require('./sessionMonitors');
const { NO_WINDOW_CONTROL, applyTimeUp } = require('./timeUp');

const CHECK_MS = 5000;
// A longer gap between checks means the computer slept; that time is not use.
const MAX_STEP_SECONDS = 15;
const POPUP_SECONDS = 300;
// How long a launch keeps Claritard running while the app starts up.
const EXPECT_MS = 60_000;

/**
 * Counts how long each app with a daily limit runs, however it was started, and closes it when
 * the day's time is used up. Time counts while any of the app's processes run, focused or not,
 * unless its rule leaves out minimized time: then only while one of its windows is on screen.
 * A rule may minimize the app instead of closing it; it is minimized again whenever restored.
 *
 * While an auto-close session times the app, that session's countdown (already cut to the daily
 * time left) is the one shown, so this shows no second countdown or warnings of its own.
 *
 * Limitation: checks every five seconds, so an app may run a few seconds past its limit, and
 * nothing is counted while Claritard is not running.
 */
class DailyLimitMonitor {
    constructor({
        paths, loadConfig, popups, notify, appearance, onChange, windows = NO_WINDOW_CONTROL, isTimed = () => false,
    }) {
        this.paths = paths;
        this.isTimed = isTimed;
        this.windows = windows;
        this.loadConfig = loadConfig;
        this.popups = popups;
        this.notify = notify;
        this.appearance = appearance;
        this.onChange = onChange;
        this.running = new Set();
        this.lastCheck = null;
        this.checking = false;
        this.expectUntil = 0;
        this.warnings = new Map();
        this.notified = new Set();
        this.timer = null;
    }

    get busy() {
        return this.running.size > 0 || Date.now() < this.expectUntil;
    }

    start() {
        if (this.timer) return;
        void this.check();
        this.timer = setInterval(() => void this.check(), CHECK_MS);
    }

    /** Keeps Claritard running while a just-launched app starts, so its time gets counted. */
    expect() {
        this.expectUntil = Date.now() + EXPECT_MS;
        this.onChange();
        setTimeout(() => this.onChange(), EXPECT_MS + 100);
    }

    async check() {
        if (this.checking) return;
        this.checking = true;
        try {
            const now = Date.now();
            const step = this.lastCheck === null ? 0 : Math.min(MAX_STEP_SECONDS, (now - this.lastCheck) / 1000);
            this.lastCheck = now;
            const usage = readDailyUsage(this.paths, now);
            const running = new Set();
            for (const app of limitedApps(this.loadConfig())) {
                const processes = runningProcesses(app.target);
                if (!processes.length) {
                    this.popups.close(`daily-${app.identity}`);
                    continue;
                }
                running.add(app.identity);
                const counting = countsNow(app, this.windows.isShowing(app.target, processes));
                const counted = this.running.has(app.identity) && counting ? step : 0;
                addDailyUsage(this.paths, 'apps', app.identity, counted, now);
                const left = remainingSeconds(app.limitSeconds, (usage.apps[app.identity] ?? 0) + counted);
                await this.enforce(app, processes, left, now, counting);
            }
            const changed = running.size !== this.running.size || [...running].some(id => !this.running.has(id));
            this.running = running;
            if (changed) this.onChange();
        } catch (error) {
            console.error('Could not check daily app limits:', error);
        } finally {
            this.checking = false;
        }
    }

    async enforce(app, processes, left, now, counting) {
        const day = `${app.identity}:${localDate(now)}`;
        if (!this.warnings.has(day)) {
            this.warnings.set(day, new Warnings({
                name: app.name, totalSeconds: app.limitSeconds, notify: this.notify, action: app.onTimeUp,
            }));
        }
        if (left > 0) {
            if (!counting || this.isTimed(app.identity)) {
                this.popups.close(`daily-${app.identity}`);
                return;
            }
            this.warnings.get(day).check(left);
            if (left <= POPUP_SECONDS) {
                this.popups.show(`daily-${app.identity}`, {
                    name: app.name,
                    deadline: now + left * 1000,
                    totalSeconds: app.limitSeconds,
                    appearance: this.appearance(),
                    action: app.onTimeUp,
                });
            }
            return;
        }
        this.popups.close(`daily-${app.identity}`);
        if (!this.notified.has(day)) {
            this.notified.add(day);
            this.notify({
                title: `${app.name} is done for today`,
                body: app.onTimeUp === 'minimize'
                    ? 'Its daily limit is used up, so it stays minimized until tomorrow.'
                    : 'Its daily limit is used up. It opens again tomorrow.',
                tag: `claritard-daily-${app.identity}`,
                targetUrl: null,
            });
        }
        // A minimized app is only minimized again once restored.
        if (app.onTimeUp === 'minimize' && this.windows.isShowing(app.target, processes) === false) return;
        await applyTimeUp({ windows: this.windows, target: app.target, processes, onTimeUp: app.onTimeUp });
    }
}

module.exports = { DailyLimitMonitor };
