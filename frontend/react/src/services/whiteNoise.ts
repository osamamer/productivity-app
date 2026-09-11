import { loadSelectedPomodoroSound } from './api/pomodoroSoundService';
import { getAuthCacheScope } from './utils/authHeaders';

const WHITE_NOISE_STORAGE_KEY = 'pomodoro-white-noise-enabled';
const DEFAULT_SOURCE = { id: 'brown-noise', url: '/audio/brown-noise.mp3' };
const VOLUME = 0.22;
const MAX_CROSSFADE_SECONDS = 3;

let enabled = readEnabled();
let source = DEFAULT_SOURCE;
const players: [HTMLAudioElement | null, HTMLAudioElement | null] = [null, null];
let activeLayer = 0;
let running = false;
let crossfadeTimer: number | null = null;
let sourceOwnerScope: string | null = null;
let initializedSourceScope: string | null = null;
let sourceLoadScope: string | null = null;
let sourceLoadPromise: Promise<void> | null = null;
let sourceRevision = 0;
let playbackRequestId = 0;

function readEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    try {
        return window.localStorage.getItem(WHITE_NOISE_STORAGE_KEY) !== 'false';
    } catch (error) {
        console.warn('Could not read Pomodoro white noise preference:', error);
        return true;
    }
}

function getPlayer(index: 0 | 1): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (players[index]) return players[index];

    const audio = new Audio(source.url);
    audio.preload = 'auto';
    audio.volume = 0;
    audio.addEventListener('timeupdate', () => handleTimeUpdate(index));
    audio.addEventListener('ended', () => handleEnded(index));
    players[index] = audio;
    return audio;
}

function clearCrossfade(): void {
    if (crossfadeTimer === null || typeof window === 'undefined') return;
    window.clearInterval(crossfadeTimer);
    crossfadeTimer = null;
}

function resetPlaybackState(): void {
    running = false;
    clearCrossfade();
    players.forEach(player => {
        if (!player) return;
        player.pause();
        player.currentTime = 0;
        player.volume = 0;
    });
    activeLayer = 0;
}

function setSource(audio: HTMLAudioElement, nextSource: { id: string; url: string }): void {
    if (audio.src === new URL(nextSource.url, window.location.href).href) return;
    audio.src = nextSource.url;
    audio.load();
}

function handleTimeUpdate(index: 0 | 1): void {
    if (!running || index !== activeLayer || crossfadeTimer !== null) return;
    const audio = players[index];
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;

    const fadeSeconds = Math.min(MAX_CROSSFADE_SECONDS, Math.max(0.25, audio.duration / 2));
    if (audio.duration - audio.currentTime <= fadeSeconds) {
        void crossfadeTo(index === 0 ? 1 : 0, fadeSeconds * 1000);
    }
}

function handleEnded(index: 0 | 1): void {
    if (!running || index !== activeLayer || crossfadeTimer !== null) return;
    // Some browsers do not emit enough timeupdate events for very short or
    // remote files. The fallback still starts the next layer immediately.
    void crossfadeTo(index === 0 ? 1 : 0, 250);
}

async function crossfadeTo(nextIndex: 0 | 1, durationMs: number): Promise<void> {
    if (crossfadeTimer !== null) return;
    const current = getPlayer(activeLayer as 0 | 1);
    const next = getPlayer(nextIndex);
    if (!current || !next) return;

    setSource(next, source);
    next.currentTime = 0;
    next.volume = 0;
    // Reserve the transition before awaiting play(); timeupdate can fire again
    // while a browser is resolving the play promise.
    crossfadeTimer = -1;
    try {
        await next.play();
    } catch (error) {
        console.warn('Could not play the next Pomodoro white noise layer:', error);
        next.pause();
        next.volume = 0;
        clearCrossfade();
        return;
    }

    if (!running) {
        next.pause();
        next.volume = 0;
        clearCrossfade();
        return;
    }

    if (current.ended) {
        clearCrossfade();
        current.volume = 0;
        next.volume = VOLUME;
        activeLayer = nextIndex;
        return;
    }

    const startedAt = performance.now();
    crossfadeTimer = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
        current.volume = VOLUME * (1 - progress);
        next.volume = VOLUME * progress;

        if (progress >= 1) {
            clearCrossfade();
            current.pause();
            current.currentTime = 0;
            current.volume = 0;
            next.volume = VOLUME;
            activeLayer = nextIndex;
        }
    }, 40);
}

export function isWhiteNoiseEnabled(): boolean {
    return enabled;
}

/**
 * Loads the authenticated user's selected source before a player is created.
 * This is shared by every focus-timer entry point so a refresh cannot create a
 * default player before the user's database preference has been resolved.
 */
export function initializeWhiteNoiseSource(): Promise<void> {
    const scope = getAuthCacheScope();
    if (initializedSourceScope === scope) return Promise.resolve();
    if (sourceLoadPromise && sourceLoadScope === scope) return sourceLoadPromise;

    if (sourceOwnerScope !== scope) {
        sourceOwnerScope = scope;
        initializedSourceScope = null;
        source = DEFAULT_SOURCE;
        sourceRevision += 1;
        resetPlaybackState();
    }

    const revisionAtStart = sourceRevision;
    sourceLoadScope = scope;
    const request = loadSelectedPomodoroSound()
        .then(selectedSource => {
            const requestIsCurrent = sourceRevision === revisionAtStart && getAuthCacheScope() === scope;
            if (requestIsCurrent) {
                setWhiteNoiseSource(selectedSource);
                initializedSourceScope = scope;
            }
        })
        .catch(error => {
            // Keep brown noise as the safe fallback if the preference request is unavailable.
            console.error('Could not load the selected Pomodoro sound:', error);
            if (sourceRevision === revisionAtStart && getAuthCacheScope() === scope) {
                initializedSourceScope = scope;
            }
        })
        .finally(() => {
            if (sourceLoadPromise === request) {
                sourceLoadPromise = null;
                sourceLoadScope = null;
            }
        });

    sourceLoadPromise = request;
    return request;
}

export function resetWhiteNoiseSource(): void {
    sourceRevision += 1;
    sourceOwnerScope = null;
    initializedSourceScope = null;
    sourceLoadScope = null;
    sourceLoadPromise = null;
    source = DEFAULT_SOURCE;
    stopWhiteNoise();
}

export function setWhiteNoiseSource(nextSource: { id: string; url: string }): void {
    const sourceScope = getAuthCacheScope();
    const sourceUnchanged = source.id === nextSource.id && source.url === nextSource.url;
    sourceOwnerScope = sourceScope;
    initializedSourceScope = sourceScope;
    sourceRevision += 1;
    if (sourceUnchanged) return;

    const wasRunning = running;
    source = nextSource;
    clearCrossfade();

    if (!wasRunning) {
        players.forEach(player => {
            if (!player) return;
            player.pause();
            player.currentTime = 0;
            player.volume = 0;
            setSource(player, source);
        });
        return;
    }

    const nextIndex = activeLayer === 0 ? 1 : 0;
    const next = getPlayer(nextIndex);
    if (!next) return;
    void crossfadeTo(nextIndex, 1500);
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
    const requestId = ++playbackRequestId;
    await initializeWhiteNoiseSource();
    if (!enabled || requestId !== playbackRequestId) return;

    const audio = getPlayer(activeLayer as 0 | 1);
    if (!audio) return;
    setSource(audio, source);
    if (!audio.paused && running) return;

    running = true;
    if (audio.ended) audio.currentTime = 0;
    audio.volume = VOLUME;
    try {
        await audio.play();
    } catch (error) {
        // Browsers may block restored sessions until the user interacts with the page.
        if (requestId === playbackRequestId) running = false;
        console.warn('Could not play Pomodoro white noise:', error);
    }
}

export function pauseWhiteNoise(): void {
    playbackRequestId += 1;
    resetPlaybackState();
}

export async function resumeWhiteNoise(): Promise<void> {
    await startWhiteNoise();
}

export function stopWhiteNoise(): void {
    playbackRequestId += 1;
    resetPlaybackState();
}
