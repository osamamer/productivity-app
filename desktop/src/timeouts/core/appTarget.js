const fs = require('node:fs');
const path = require('node:path');
const { MAIN_GROUP, parseDesktopEntry, getString, splitExec } = require('./desktopEntry');

const SHELLS = new Set(['sh', 'bash', 'dash', 'flatpak', 'env']);
const INTERPRETERS = ['python', 'ruby', 'perl', 'node'];

function which(command, env = process.env) {
    if (command.includes('/')) return command;
    for (const dir of (env.PATH || '').split(':')) {
        if (!dir) continue;
        const candidate = path.join(dir, command);
        try {
            fs.accessSync(candidate, fs.constants.X_OK);
            if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
            // Not in this directory.
        }
    }
    return null;
}

function resolvePath(file) {
    try {
        return fs.realpathSync(file);
    } catch {
        return path.resolve(file);
    }
}

/**
 * What a launcher actually runs, so its processes can be found later: `{ flatpak: id }` for
 * Flatpak apps, `{ executable, script? }` otherwise. Shell wrappers are refused because the
 * process they start cannot be identified reliably.
 */
function appTarget(desktopText) {
    const entry = parseDesktopEntry(desktopText);
    let words = splitExec(getString(entry, MAIN_GROUP, 'Exec') ?? '');
    let flatpakId = getString(entry, MAIN_GROUP, 'X-Flatpak');
    if (!flatpakId && words.length && path.basename(words[0]) === 'flatpak') {
        flatpakId = words.slice(2).find(word => !word.startsWith('-') && (word.match(/\./g) ?? []).length >= 2) ?? null;
    }
    if (flatpakId) return { flatpak: flatpakId.trim() };
    if (words.length && path.basename(words[0]) === 'env') {
        words = words.slice(1);
        while (words.length && words[0].includes('=')) words.shift();
    }
    if (!words.length || SHELLS.has(path.basename(words[0]))) {
        throw new Error('This launcher uses a shell wrapper that cannot be tracked safely.');
    }
    const executable = which(words[0]) ?? words[0];
    const target = { executable: resolvePath(executable) };
    if (INTERPRETERS.some(prefix => path.basename(executable).startsWith(prefix))) {
        if (words.length < 2 || !isFile(words[1])) throw new Error('This interpreter launcher cannot be tracked safely.');
        target.script = resolvePath(words[1]);
    }
    return target;
}

function isFile(file) {
    try {
        return fs.statSync(file).isFile();
    } catch {
        return false;
    }
}

module.exports = { appTarget, which };
