const fs = require('node:fs');
const path = require('node:path');

const STALE_MS = 15_000;
const RETRY_MS = 50;
const TIMEOUT_MS = 10_000;

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Runs `work` while holding an exclusive lock file, shared between Claritard and the Firefox
 * native host. A lock older than 15 seconds is treated as left behind by a crashed process.
 *
 * Limitation: blocks the calling thread while waiting; only use it around quick file updates.
 */
function withFileLock(lockFile, work) {
    fs.mkdirSync(path.dirname(lockFile), { recursive: true });
    const started = Date.now();
    let fd = null;
    while (fd === null) {
        try {
            fd = fs.openSync(lockFile, 'wx');
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            try {
                if (Date.now() - fs.statSync(lockFile).mtimeMs > STALE_MS) fs.rmSync(lockFile, { force: true });
            } catch {
                // Released between the open and the stat.
            }
            if (Date.now() - started > TIMEOUT_MS) throw new Error('Timed out waiting for the Firefox timer lock.');
            sleep(RETRY_MS);
        }
    }
    try {
        return work();
    } finally {
        fs.closeSync(fd);
        fs.rmSync(lockFile, { force: true });
    }
}

module.exports = { withFileLock };
