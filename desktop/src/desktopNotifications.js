const { Notification } = require('electron');

// Linux notification servers do not always report dismissals, so keep a bounded history.
const MAX_TRACKED = 50;

/**
 * Shows the web app's notifications as native desktop notifications. Electron cannot list
 * service-worker notifications (getNotifications() never settles), so the page hands them here.
 *
 * Notifications are kept referenced until clicked or closed; otherwise they can be garbage
 * collected and their click handler lost.
 */
class DesktopNotifications {
    constructor({ icon, onClick }) {
        this.icon = icon;
        this.onClick = onClick;
        this.tracked = new Map();
    }

    /** Returns false when the desktop has no notification service, so the page can fall back. */
    show({ title, body, tag, targetUrl }) {
        if (!Notification.isSupported()) return false;
        // Same rule as the browser path: a tag already on screen is not shown twice.
        if (tag && this.tracked.has(tag)) return true;

        const key = tag ?? Symbol('notification');
        const notification = new Notification({ title, body, icon: this.icon });
        const forget = () => this.tracked.delete(key);
        notification.on('click', () => {
            forget();
            this.onClick(targetUrl);
        });
        notification.on('close', forget);
        notification.on('failed', (_event, error) => {
            console.error('The desktop notification could not be shown:', error);
            forget();
        });

        this.tracked.set(key, notification);
        if (this.tracked.size > MAX_TRACKED) this.tracked.delete(this.tracked.keys().next().value);
        notification.show();
        return true;
    }
}

module.exports = { DesktopNotifications };
