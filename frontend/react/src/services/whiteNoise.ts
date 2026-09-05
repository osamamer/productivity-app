const WHITE_NOISE_STORAGE_KEY = 'pomodoro-white-noise-enabled';
const WHITE_NOISE_URL = '/audio/rain.mp3';

let enabled = readEnabled();
let player: HTMLAudioElement | null = null;

function readEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    try {
        return window.localStorage.getItem(WHITE_NOISE_STORAGE_KEY) !== 'false';
    } catch (error) {
        console.warn('Could not read Pomodoro white noise preference:', error);
        return true;
    }
}

function getPlayer(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (player) return player;

    player = new Audio(WHITE_NOISE_URL);
    player.loop = true;
    player.volume = 0.22;
    return player;
}

export function isWhiteNoiseEnabled(): boolean {
    return enabled;
}

export function setWhiteNoiseEnabled(nextEnabled: boolean): void {
    enabled = nextEnabled;
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(WHITE_NOISE_STORAGE_KEY, String(nextEnabled));
        } catch (error) {
            console.warn('Could not save Pomodoro white noise preference:', error);
        }
    }
    if (!nextEnabled) stopWhiteNoise();
}

export async function startWhiteNoise(): Promise<void> {
    if (!enabled) return;
    const audio = getPlayer();
    if (!audio || !audio.paused) return;

    try {
        await audio.play();
    } catch (error) {
        // Browsers may block restored sessions until the user interacts with the page.
        console.warn('Could not play Pomodoro white noise:', error);
    }
}

export function pauseWhiteNoise(): void {
    player?.pause();
}

export async function resumeWhiteNoise(): Promise<void> {
    await startWhiteNoise();
}

export function stopWhiteNoise(): void {
    if (!player) return;
    player.pause();
    player.currentTime = 0;
}
