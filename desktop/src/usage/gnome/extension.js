// GNOME Shell extension (45+) installed by Claritard: reports the focused window over D-Bus.
// Wayland hides other apps' windows from ordinary clients, so only the shell can tell.
// It only calls while the app owns its D-Bus name, so it is inert when Claritard is closed.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const SERVICE = 'app.claritard.Usage';
const PATH = '/app/claritard/Usage';
const INTERFACE = 'app.claritard.Usage';

// The shell's app id is the desktop file name; windows it cannot match get a fake `window:N` id.
function appIdOf(window, tracker) {
    const id = tracker.get_window_app(window)?.get_id() ?? '';
    if (id && !id.startsWith('window:')) return id.replace(/\.desktop$/, '');
    return window.get_gtk_application_id() || window.get_sandboxed_app_id() || window.get_wm_class() || '';
}

export default class ClaritardUsageExtension extends Extension {
    enable() {
        this._tracker = Shell.WindowTracker.get_default();
        this._window = null;
        this._windowSignals = [];
        this._listening = false;
        this._displaySignal = global.display.connect('notify::focus-window', () => this._focusChanged());
        this._trackerSignal = this._tracker.connect('notify::focus-app', () => this._send('Focus'));
        this._nameWatch = Gio.bus_watch_name(
            Gio.BusType.SESSION, SERVICE, Gio.BusNameWatcherFlags.NONE,
            () => {
                this._listening = true;
                this._send('Focus');
            },
            () => {
                this._listening = false;
            });
        this._focusChanged();
    }

    disable() {
        this._unwatchWindow();
        global.display.disconnect(this._displaySignal);
        this._tracker.disconnect(this._trackerSignal);
        Gio.bus_unwatch_name(this._nameWatch);
        this._tracker = null;
        this._listening = false;
    }

    _focusChanged() {
        this._unwatchWindow();
        const window = global.display.focus_window;
        if (window) {
            this._window = window;
            this._windowSignals = [
                window.connect('notify::title', () => this._send('Title')),
                window.connect('notify::fullscreen', () => this._send('Title')),
                window.connect('unmanaged', () => this._unwatchWindow()),
            ];
        }
        this._send('Focus');
    }

    _unwatchWindow() {
        for (const id of this._windowSignals) this._window.disconnect(id);
        this._windowSignals = [];
        this._window = null;
    }

    _send(method) {
        if (!this._listening) return;
        const window = this._window;
        const args = window
            ? [appIdOf(window, this._tracker), window.get_title() ?? '', window.is_fullscreen()]
            : ['', '', false];
        Gio.DBus.session.call(
            SERVICE, PATH, INTERFACE, method, new GLib.Variant('(ssb)', args),
            null, Gio.DBusCallFlags.NO_AUTO_START, -1, null,
            (connection, result) => {
                try {
                    connection.call_finish(result);
                } catch (error) {
                    // Claritard quit between the name check and the call; nothing to report to.
                }
            });
    }
}
