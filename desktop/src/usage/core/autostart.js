const fs = require('node:fs');
const path = require('node:path');

const HIDDEN_SWITCH = '--hidden';

// Desktop Entry Exec quoting: arguments with reserved characters go in double quotes.
function quoteExecArgument(value) {
    const text = String(value);
    if (!/[\s"'\\$`<>~|&;*?#()]/.test(text)) return text;
    return `"${text.replace(/(["`$\\])/g, '\\$1')}"`;
}

/** The XDG autostart entry that starts Claritard in the tray at login. */
function autostartEntry(command) {
    const exec = [...command, HIDDEN_SWITCH].map(quoteExecArgument).join(' ');
    return [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Claritard',
        'Comment=Starts Claritard in the tray so reminders and screen time keep working',
        `Exec=${exec}`,
        'Icon=claritard',
        'Terminal=false',
        'X-GNOME-Autostart-enabled=true',
        '',
    ].join('\n');
}

function isAutostartEnabled(file) {
    return fs.existsSync(file);
}

function setAutostart(file, enabled, command) {
    if (!enabled) {
        fs.rmSync(file, { force: true });
        return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, autostartEntry(command));
}

module.exports = { HIDDEN_SWITCH, autostartEntry, isAutostartEnabled, setAutostart };
