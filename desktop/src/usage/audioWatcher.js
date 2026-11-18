const { spawn, execFile } = require('node:child_process');
const readline = require('node:readline');
const { playingPids } = require('./core/audio');

const REFRESH_DELAY_MS = 200;

/**
 * Follows which processes are playing audio, through `pactl` (PulseAudio or pipewire-pulse):
 * `pactl subscribe` says when a stream changes, then the stream list is read again.
 * Calls `onChange(pids)` with a Set, or with null once audio can no longer be seen.
 *
 * Limitation: needs `pactl`; `start` rejects without it.
 */
class AudioWatcher {
    constructor({ onChange, pactl = 'pactl' }) {
        this.onChange = onChange;
        this.pactl = pactl;
        this.child = null;
        this.timer = null;
        this.stopped = false;
    }

    async start() {
        await this.refresh();
        this.child = spawn(this.pactl, ['subscribe'], { stdio: ['ignore', 'pipe', 'ignore'] });
        this.child.on('error', error => this.lost(error));
        this.child.on('exit', code => this.lost(new Error(`pactl subscribe exited with ${code}`)));
        readline.createInterface({ input: this.child.stdout }).on('line', line => {
            if (line.includes('sink-input')) this.scheduleRefresh();
        });
    }

    scheduleRefresh() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.refresh().catch(error => console.error(`Could not read audio streams: ${error.message}`, error));
        }, REFRESH_DELAY_MS);
    }

    refresh() {
        return new Promise((resolve, reject) => {
            execFile(this.pactl, ['-f', 'json', 'list', 'sink-inputs'], { timeout: 5000 }, (error, stdout) => {
                if (error) return reject(error);
                try {
                    const pids = playingPids(stdout);
                    if (!this.stopped) this.onChange(pids);
                    resolve();
                } catch (parseError) {
                    reject(parseError);
                }
            });
        });
    }

    lost(error) {
        if (this.stopped) return;
        console.error(`Screen time stopped following audio: ${error.message}`, error);
        this.stopped = true;
        clearTimeout(this.timer);
        this.onChange(null);
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        this.child?.removeAllListeners();
        this.child?.kill();
        this.child = null;
    }
}

module.exports = { AudioWatcher };
