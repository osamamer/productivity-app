import {
    BUILT_IN_POMODORO_SOUND,
    getPomodoroSoundAudioUrl,
    getPomodoroSounds,
    loadSelectedPomodoroSound,
    PomodoroSound,
} from './api/pomodoroSoundService';
import { userService } from './api/userService';
import { getRuntimeUserPreference, subscribeToUserPreferences, updateRuntimeUserPreferences } from './userPreferenceStore';
import { getAuthCacheScope } from './utils/authHeaders';

export interface WhiteNoiseSource {
    id: string;
    name: string;
    url: string;
}

const DEFAULT_SOURCE: WhiteNoiseSource = {
    id: BUILT_IN_POMODORO_SOUND.id,
    name: BUILT_IN_POMODORO_SOUND.name,
    url: '/audio/brown-noise.mp3',
};
const VOLUME = 0.22;
const MAX_CROSSFADE_SECONDS = 3;

let enabled = getRuntimeUserPreference('whiteNoiseEnabled');
let source = DEFAULT_SOURCE;
const players: [HTMLAudioElement | null, HTMLAudioElement | null] = [null, null];
let activeLayer = 0;
let running = false;
let crossfadeTimer: number | null = null;
let crossfadeGeneration = 0;
let sourceOwnerScope: string | null = null;
let initializedSourceScope: string | null = null;
let sourceLoadScope: string | null = null;
let sourceLoadPromise: Promise<void> | null = null;
let sourceRevision = 0;
let playbackRequestId = 0;
let preferenceRevision = 0;
let sourceSelectionQueue: Promise<void> = Promise.resolve();
const sourceListeners = new Set<(source: WhiteNoiseSource) => void>();

subscribeToUserPreferences(() => {
    enabled = getRuntimeUserPreference('whiteNoiseEnabled');
});

export function getWhiteNoiseSource(): WhiteNoiseSource {
    return { ...source };
}

export function subscribeToWhiteNoiseSource(listener: (nextSource: WhiteNoiseSource) => void): () => void {
    sourceListeners.add(listener);
    return () => sourceListeners.delete(listener);
}

function publishSource(): void {
    const nextSource = getWhiteNoiseSource();
    sourceListeners.forEach(listener => listener(nextSource));
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
    crossfadeGeneration += 1;
    if (crossfadeTimer !== null && typeof window !== 'undefined') {
        window.clearInterval(crossfadeTimer);
    }
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
    const generation = crossfadeGeneration;

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
        if (generation === crossfadeGeneration) {
            next.pause();
            next.volume = 0;
            clearCrossfade();
        }
        return;
    }

    if (!running || generation !== crossfadeGeneration) {
        if (generation === crossfadeGeneration) {
            next.pause();
            next.volume = 0;
            clearCrossfade();
        }
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
    const timer = window.setInterval(() => {
        if (!running || generation !== crossfadeGeneration) {
            window.clearInterval(timer);
            if (generation === crossfadeGeneration && crossfadeTimer === timer) {
                crossfadeTimer = null;
                next.pause();
                next.volume = 0;
            }
            return;
        }

        const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
        current.volume = VOLUME * (1 - progress);
        next.volume = VOLUME * progress;

        if (progress >= 1) {
            window.clearInterval(timer);
            if (crossfadeTimer === timer) crossfadeTimer = null;
            current.pause();
            current.currentTime = 0;
            current.volume = 0;
            next.volume = VOLUME;
            activeLayer = nextIndex;
        }
    }, 40);
    crossfadeTimer = timer;
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
    publishSource();
    stopWhiteNoise();
}

export function setWhiteNoiseSource(nextSource: { id: string; name?: string; url: string }): void {
    const sourceScope = getAuthCacheScope();
    const nextName = nextSource.name
        ?? (nextSource.id === source.id ? source.name : nextSource.id === DEFAULT_SOURCE.id ? DEFAULT_SOURCE.name : 'Focus sound');
    const sourceUnchanged = source.id === nextSource.id && source.url === nextSource.url && source.name === nextName;
    sourceOwnerScope = sourceScope;
    initializedSourceScope = sourceScope;
    sourceRevision += 1;
    if (sourceUnchanged) return;

    const wasRunning = running;
    source = { id: nextSource.id, name: nextName, url: nextSource.url };
    publishSource();
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

export async function getAvailableWhiteNoiseSounds(): Promise<PomodoroSound[]> {
    return [BUILT_IN_POMODORO_SOUND, ...(await getPomodoroSounds())];
}

async function applyWhiteNoiseSound(sound: PomodoroSound): Promise<WhiteNoiseSource> {
    await initializeWhiteNoiseSource();
    const scope = getAuthCacheScope();
    const url = await getPomodoroSoundAudioUrl(sound);
    if (getAuthCacheScope() !== scope) return getWhiteNoiseSource();

    if (sound.id !== source.id && scope !== 'anonymous') {
        await userService.updatePreferences({ pomodoroSoundId: sound.id });
    }
    if (getAuthCacheScope() !== scope) return getWhiteNoiseSource();

    setWhiteNoiseSource({ id: sound.id, name: sound.name, url });
    return getWhiteNoiseSource();
}

function queueWhiteNoiseSoundChange(change: () => Promise<WhiteNoiseSource>): Promise<WhiteNoiseSource> {
    const request = sourceSelectionQueue.then(change);
    sourceSelectionQueue = request.then(() => undefined, () => undefined);
    return request;
}

export function selectWhiteNoiseSound(sound: PomodoroSound): Promise<WhiteNoiseSource> {
    return queueWhiteNoiseSoundChange(() => applyWhiteNoiseSound(sound));
}

export function setWhiteNoiseEnabled(nextEnabled: boolean): void {
    const previousEnabled = enabled;
    const revision = ++preferenceRevision;
    enabled = nextEnabled;
    updateRuntimeUserPreferences({ whiteNoiseEnabled: nextEnabled });
    // Muting is a pause, not the end of the sound session. Keep the active
    // layer's currentTime so turning the sound back on resumes in place.
    if (!nextEnabled) pauseWhiteNoise();

    if (getAuthCacheScope() === 'anonymous') return;
    void userService.updatePreferences({ whiteNoiseEnabled: nextEnabled }).catch(error => {
        console.error('Could not save focus audio preference:', error);
        if (revision !== preferenceRevision) return;
        enabled = previousEnabled;
        updateRuntimeUserPreferences({ whiteNoiseEnabled: previousEnabled });
    });
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
    running = false;
    clearCrossfade();
    players.forEach(player => {
        if (!player) return;
        player.pause();
        player.volume = 0;
    });
}

export async function resumeWhiteNoise(): Promise<void> {
    await startWhiteNoise();
}

export function stopWhiteNoise(): void {
    playbackRequestId += 1;
    resetPlaybackState();
}
