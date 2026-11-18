const dbus = require('dbus-next');

const SERVICE = 'app.claritard.Usage';
const OBJECT_PATH = '/app/claritard/Usage';

class UsageInterface extends dbus.interface.Interface {
    constructor(handlers) {
        super(SERVICE);
        this.handlers = handlers;
    }

    // Focus and Title stay for a GNOME extension from an older release: GNOME Shell keeps
    // running the old code until the next login. Without a pid, sound is unknown.
    Focus(appId, title, fullscreen) {
        this.handlers.onFocus({ appId, title, fullscreen, pid: 0 });
    }

    Title(appId, title, fullscreen) {
        this.handlers.onTitle({ appId, title, fullscreen, pid: 0 });
    }

    // The pid is a string because KWin's callDBus would send a JS number as a double.
    FocusWithPid(appId, title, fullscreen, pid) {
        this.handlers.onFocus({ appId, title, fullscreen, pid: Number(pid) || 0 });
    }

    TitleWithPid(appId, title, fullscreen, pid) {
        this.handlers.onTitle({ appId, title, fullscreen, pid: Number(pid) || 0 });
    }
}

UsageInterface.configureMembers({
    methods: {
        Focus: { inSignature: 'ssb', outSignature: '' },
        Title: { inSignature: 'ssb', outSignature: '' },
        FocusWithPid: { inSignature: 'ssbs', outSignature: '' },
        TitleWithPid: { inSignature: 'ssbs', outSignature: '' },
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
