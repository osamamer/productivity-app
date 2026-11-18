const fs = require('node:fs');
const path = require('node:path');

const EXTENSION_UUID = 'claritard-usage@claritard.app';
const EXTENSION_FILES = ['metadata.json', 'extension.js'];

// GNOME Shell's ExtensionState values (js/misc/extensionUtils.js).
const STATE = { ENABLED: 1, ERROR: 3, OUT_OF_DATE: 4 };

/**
 * Copies the bundled extension into `targetDir`, writing only files that differ. Returns true
 * when something changed: a running shell keeps the old code until the next login.
 */
function installExtension(sourceDir, targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
    let changed = false;
    for (const name of EXTENSION_FILES) {
        const wanted = fs.readFileSync(path.join(sourceDir, name));
        const target = path.join(targetDir, name);
        const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
        if (current && current.equals(wanted)) continue;
        fs.writeFileSync(target, wanted);
        changed = true;
    }
    return changed;
}

/**
 * Why the shell is not running the extension, as a message for the user, or null when it is.
 * `info` is GetExtensionInfo's reply with variants unwrapped; it is empty when the shell has
 * never seen the extension, because GNOME only looks for new extensions at login.
 */
function extensionProblem(info, { userExtensionsEnabled = true } = {}) {
    if (!userExtensionsEnabled) {
        return 'GNOME has extensions turned off. Turn them on in the Extensions app so screen time can see which window is in focus.';
    }
    if (!info || info.state === undefined) {
        return 'GNOME needs one new login before screen time can start. Log out and back in, then open Claritard again.';
    }
    if (info.state === STATE.ENABLED) return null;
    if (info.state === STATE.OUT_OF_DATE) return 'This GNOME version is too new for the screen-time extension.';
    if (info.state === STATE.ERROR) {
        return `GNOME could not run the screen-time extension${info.error ? `: ${info.error}` : '.'}`;
    }
    return 'GNOME did not turn on the screen-time extension.';
}

module.exports = { EXTENSION_UUID, installExtension, extensionProblem };
