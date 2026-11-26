const fs = require('node:fs');
const path = require('node:path');

const WRAPPER_SHELLS = new Set(['sh', 'bash', 'dash']);
const MAX_WRAPPER_BYTES = 4096;
const MAX_DEPTH = 4;
// Ways a wrapper names its own folder, real or as invoked.
const REAL_DIR = [
    '$(dirname "$(readlink -f "$0")")',
    '$(dirname "$(readlink -f -- "$0")")',
    '$(dirname "$(realpath "$0")")',
];
const INVOKED_DIR = ['$(dirname "$0")', '$(dirname -- "$0")', '${0%/*}'];
const EXEC_LINE = /^exec\s+(?:"([^"$`\\]+)"|([^\s"'$`\\]+))\s+"\$@"$/;

function readHead(file) {
    try {
        const fd = fs.openSync(file, 'r');
        try {
            const buffer = Buffer.alloc(MAX_WRAPPER_BYTES + 1);
            const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
            return length > MAX_WRAPPER_BYTES ? null : buffer.subarray(0, length).toString('utf8');
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
}

function isExecutableFile(file) {
    try {
        fs.accessSync(file, fs.constants.X_OK);
        return fs.statSync(file).isFile();
    } catch {
        return false;
    }
}

/**
 * The program a one-line shell wrapper hands over to, or null when `invoked` is not such a
 * wrapper. Only `#!/bin/sh` scripts whose whole body is `exec <program> "$@"` count, because
 * `exec` replaces the shell: the app's processes then run `<program>`, never the script.
 */
function wrappedProgram(invoked) {
    const real = fs.realpathSync(invoked);
    const text = readHead(real);
    if (!text?.startsWith('#!')) return null;
    const [shebang, ...rest] = text.split('\n');
    const interpreter = shebang.slice(2).trim().split(/\s+/);
    const shell = path.basename(interpreter[0] === '/usr/bin/env' ? interpreter[1] ?? '' : interpreter[0]);
    if (!WRAPPER_SHELLS.has(shell)) return null;
    const body = rest.map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    if (body.length !== 1) return null;
    let line = body[0];
    for (const idiom of REAL_DIR) line = line.split(idiom).join(path.dirname(real));
    for (const idiom of INVOKED_DIR) line = line.split(idiom).join(path.dirname(invoked));
    const match = EXEC_LINE.exec(line);
    const program = match && (match[1] ?? match[2]);
    return program && path.isAbsolute(program) && isExecutableFile(program) ? program : null;
}

/**
 * Follows wrappers like `exec "$(dirname "$(readlink -f "$0")")/ChatGPT" "$@"` (the ChatGPT
 * desktop app's `codex-launcher`) to the program that actually runs. Anything else is returned
 * unchanged.
 */
function followExecWrappers(executable) {
    let current = executable;
    for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
        let next;
        try {
            next = wrappedProgram(current);
        } catch {
            return current;
        }
        if (!next) return current;
        current = next;
    }
    return current;
}

module.exports = { followExecWrappers };
