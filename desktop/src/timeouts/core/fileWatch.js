const fs = require('node:fs');
const path = require('node:path');

/**
 * Calls onChange shortly after a file in `dir` whose name passes `filter` is written, created or
 * deleted. Bursts of events within `debounceMs` produce one call. Returns a function that stops
 * watching.
 */
function watchDir(dir, onChange, { filter = () => true, debounceMs = 150 } = {}) {
    fs.mkdirSync(dir, { recursive: true });
    let timer = null;
    const watcher = fs.watch(dir, (_event, changed) => {
        if (changed && !filter(changed)) return;
        clearTimeout(timer);
        timer = setTimeout(onChange, debounceMs);
    });
    watcher.on('error', error => console.error(`Stopped watching ${dir}:`, error));
    return () => {
        clearTimeout(timer);
        watcher.close();
    };
}

/**
 * Calls onChange shortly after `file` is written, created or deleted. Watches the parent folder
 * rather than the file because saveConfig replaces the file by rename, which would orphan a
 * watch on the old inode.
 */
function watchFile(file, onChange, options = {}) {
    const name = path.basename(file);
    return watchDir(path.dirname(file), onChange, { ...options, filter: changed => changed === name });
}

module.exports = { watchDir, watchFile };
