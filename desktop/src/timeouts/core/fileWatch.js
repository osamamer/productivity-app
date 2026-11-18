const fs = require('node:fs');
const path = require('node:path');

/**
 * Calls onChange shortly after `file` is written, created or deleted. Watches the parent folder
 * rather than the file because saveConfig replaces the file by rename, which would orphan a
 * watch on the old inode. Bursts of events within `debounceMs` produce one call.
 * Returns a function that stops watching.
 */
function watchFile(file, onChange, { debounceMs = 150 } = {}) {
    const dir = path.dirname(file);
    const name = path.basename(file);
    fs.mkdirSync(dir, { recursive: true });
    let timer = null;
    const watcher = fs.watch(dir, (_event, changed) => {
        if (changed && changed !== name) return;
        clearTimeout(timer);
        timer = setTimeout(onChange, debounceMs);
    });
    return () => {
        clearTimeout(timer);
        watcher.close();
    };
}

module.exports = { watchFile };
