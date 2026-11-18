const dbus = require('dbus-next');

const SERVICE = 'app.claritard.Usage';
const OBJECT_PATH = '/app/claritard/Usage';

class UsageInterface extends dbus.interface.Interface {
    constructor(handlers) {
        super(SERVICE);
        this.handlers = handlers;
    }

    Focus(appId, title, fullscreen) {
        this.handlers.onFocus({ appId, title, fullscreen });
    }

    Title(appId, title, fullscreen) {
        this.handlers.onTitle({ appId, title, fullscreen });
    }
}

UsageInterface.configureMembers({
    methods: {
        Focus: { inSignature: 'ssb', outSignature: '' },
        Title: { inSignature: 'ssb', outSignature: '' },
    },
});

/**
 * Owns `app.claritard.Usage` on the session bus, which the KWin script and the GNOME Shell
 * extension call with the focused window. Rejects when another copy of the app owns it.
 */
async function claimFocusService(bus, { onFocus, onTitle }) {
    const owned = await bus.requestName(SERVICE, dbus.NameFlag.DO_NOT_QUEUE);
    if (owned !== dbus.RequestNameReply.PRIMARY_OWNER && owned !== dbus.RequestNameReply.ALREADY_OWNER) {
        throw new Error('Another program is already tracking screen time for Claritard.');
    }
    bus.export(OBJECT_PATH, new UsageInterface({ onFocus, onTitle }));
}

module.exports = { claimFocusService };
