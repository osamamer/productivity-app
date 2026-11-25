const ANNOUNCE_AGAIN_AFTER_MS = 60_000;

function clockTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function minutesLeft(deadline, now) {
    const minutes = Math.max(1, Math.round((deadline - now) / 60_000));
    return `${minutes} minute${minutes === 1 ? '' : 's'} left`;
}

/**
 * Shows the time left before an app closes, the way the Boundaries page chose: the small
 * always-on-top window, or one system notification saying when it closes. Monitors call `show`
 * as often as they like; a notification is only sent again when the deadline moves by more than
 * a minute (for example after a pause while the app was minimized).
 */
class CountdownDisplay {
    constructor({ popups, notify, mode }) {
        this.popups = popups;
        this.notify = notify;
        this.mode = mode;
        this.announced = new Map();
    }

    show(key, options) {
        if (this.mode() === 'notification') {
            this.popups.close(key);
            this.announce(options);
        } else {
            this.popups.show(key, options);
        }
    }

    close(key) {
        this.popups.close(key);
    }

    /** Applies a new display choice to countdowns already showing. */
    modeChanged() {
        this.popups.closeAll();
        this.announced.clear();
    }

    announce({ name, deadline, action = 'close' }, now = Date.now()) {
        const previous = this.announced.get(name);
        if (previous !== undefined && Math.abs(previous - deadline) < ANNOUNCE_AGAIN_AFTER_MS) return;
        this.announced.set(name, deadline);
        this.notify({
            title: `${name} ${action === 'minimize' ? 'minimizes' : 'closes'} at ${clockTime(deadline)}`,
            body: `${minutesLeft(deadline, now)}.`,
            tag: `claritard-countdown-${name}`,
            targetUrl: null,
        });
    }
}

module.exports = { CountdownDisplay };
