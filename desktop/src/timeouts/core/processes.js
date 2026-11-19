const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { profileArgument } = require('./profileArgument');

const FLATPAK = '/usr/bin/flatpak';
const KILL_GRACE_MS = 5000;

/**
 * The process start time from /proc, used to tell a process apart from a later one that reused
 * its PID. Null for processes of other users, zombies, and processes that have gone.
 */
function processStamp(pid) {
    try {
        const dir = `/proc/${pid}`;
        if (fs.statSync(dir).uid !== process.getuid()) return null;
        const fields = fs.readFileSync(path.join(dir, 'stat'), 'utf8').split(')').pop().trim().split(/\s+/);
        return fields[0] === 'Z' ? null : fields[19];
    } catch {
        return null;
    }
}

function flatpakInstances(appId) {
    const output = execFileSync(FLATPAK, ['ps', '--columns=application,instance,pid'], { encoding: 'utf8', timeout: 3000 });
    const found = [];
    for (const line of output.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 3 && parts[0] === appId) found.push({ pid: Number(parts[2]), instance: parts[1] });
    }
    return found;
}

function readProcess(pid) {
    const argv = fs.readFileSync(`/proc/${pid}/cmdline`).toString('utf8').split('\0');
    let executable = '';
    try {
        executable = fs.realpathSync(`/proc/${pid}/exe`);
    } catch {
        // Kernel threads and some sandboxed processes hide their executable.
    }
    return { argv, executable };
}

/**
 * The current user's processes running `target`: `{ flatpak }` matches a Flatpak app's
 * instances, `{ executable, script? }` matches a native binary or an interpreter running a script.
 * A native process only matches when its `--profile` argument equals `target.profile` (none
 * matches none), so closing an app's default profile never ends one of its light profiles.
 * `anyProfile: true` turns that off, for Firefox timers that must close every profile.
 *
 * Limitation: Flatpak instances are matched by app ID alone, ignoring profiles.
 */
function runningProcesses(target) {
    if (target.flatpak) return flatpakInstances(target.flatpak);
    const found = [];
    for (const name of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
        const pid = Number(name);
        const stamp = processStamp(pid);
        if (stamp === null) continue;
        let info;
        try {
            info = readProcess(pid);
        } catch {
            continue;
        }
        let same = info.executable === target.executable;
        // Executable scripts appear as an argument to their interpreter.
        if (!same && isFile(target.executable)) same = info.argv.slice(0, 2).includes(target.executable);
        if (!same || (target.script && !info.argv.slice(1, 3).includes(target.script))) continue;
        if (!target.anyProfile && profileArgument(info.argv.slice(1)) !== (target.profile ?? null)) continue;
        found.push({ pid, stamp });
    }
    return found;
}

function isFile(file) {
    try {
        return fs.statSync(file).isFile();
    } catch {
        return false;
    }
}

/** Whether any process of the original session is still running. */
function sameSession(target, original, current) {
    if (target.flatpak) {
        // flatpak ps can report a different leader PID for the same instance.
        return original.some(first => current.some(second => first.instance === second.instance));
    }
    return original.some(first => current.some(second => first.pid === second.pid && first.stamp === second.stamp));
}

function signalIfSame(proc, signal) {
    try {
        if (processStamp(proc.pid) === proc.stamp) process.kill(proc.pid, signal);
    } catch (error) {
        if (error.code !== 'ESRCH') console.error(`Could not signal process ${proc.pid}:`, error);
    }
}

/**
 * Ends the processes of one session that are still running: Flatpak instances through
 * `flatpak kill`, native processes with SIGTERM and then SIGKILL after five seconds. PIDs are
 * re-checked against their start time first, so a reused PID is never signalled.
 */
async function endSession(target, original) {
    const current = runningProcesses(target);
    if (target.flatpak) {
        const live = new Set(current.map(proc => proc.instance));
        for (const instance of new Set(original.map(proc => proc.instance))) {
            if (!live.has(instance)) continue;
            try {
                execFileSync(FLATPAK, ['kill', instance], { timeout: 5000 });
            } catch (error) {
                console.error(`Could not stop Flatpak instance ${instance}:`, error);
            }
        }
        return;
    }
    const victims = original.filter(proc => current.some(other => other.pid === proc.pid && other.stamp === proc.stamp));
    if (!victims.length) return;
    for (const proc of victims) signalIfSame(proc, 'SIGTERM');
    await new Promise(resolve => setTimeout(resolve, KILL_GRACE_MS));
    for (const proc of victims) signalIfSame(proc, 'SIGKILL');
}

module.exports = { processStamp, runningProcesses, sameSession, endSession };
