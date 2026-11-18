const fs = require('node:fs');

const MAX_ANCESTORS = 32;

/** The process ids with an audio stream that is playing (not corked), from `pactl -f json list sink-inputs`. */
function playingPids(json) {
    const pids = new Set();
    for (const input of JSON.parse(json)) {
        const pid = Number(input?.properties?.['application.process.id']);
        if (!input.corked && Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return pids;
}

function parentFromProc(pid) {
    try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
        // The command name in parentheses may itself contain spaces or parentheses.
        return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]) || null;
    } catch {
        return null;
    }
}

/**
 * Whether the window's process, or a process it started, is playing audio. Browsers play from
 * a child process (Chromium's audio service), so the stream's pid is walked up to the window's.
 *
 * Limitation: sandboxed apps that report pids from their own namespace (Flatpak) never match.
 */
function isPlayingFor(windowPid, pids, parentOf = parentFromProc) {
    if (!windowPid) return false;
    for (const pid of pids) {
        let current = pid;
        for (let depth = 0; current && current > 1 && depth < MAX_ANCESTORS; depth++) {
            if (current === windowPid) return true;
            current = parentOf(current);
        }
    }
    return false;
}

module.exports = { playingPids, isPlayingFor };
