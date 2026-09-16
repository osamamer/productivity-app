import {
    BUILT_IN_POMODORO_SOUND,
    getPomodoroSoundAudioUrl,
    getPomodoroSounds,
    loadSelectedPomodoroSoundMetadata,
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
const AUDIO_READY_STATE = 3;
const AUDIO_PRELOAD_TIMEOUT_MS = 15_000;

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
let sourceSelectionRevision = 0;
let sourcePreloadRevision: number | null = null;
let sourcePreloadPromise: Promise<void> | null = null;
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

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = source.url;
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

function preloadAudio(audio: HTMLAudioElement): Promise<void> {
    if (audio.readyState >= AUDIO_READY_STATE) return Promise.resolve();

    return new Promise(resolve => {
        let settled = false;
        const timeoutId = window.setTimeout(finish, AUDIO_PRELOAD_TIMEOUT_MS);

        function finish(): void {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            audio.removeEventListener('canplaythrough', finish);
            audio.removeEventListener('error', finish);
            resolve();
        }

        audio.addEventListener('canplaythrough', finish);
        audio.addEventListener('error', finish);
        audio.load();
        if (audio.readyState >= AUDIO_READY_STATE) finish();
    });
}

/**
 * Creates both playback layers and asks the browser to buffer the selected
 * source before a focus session needs it. Loading is best effort: a slow or
 * unavailable file must not prevent the Pomodoro controls from working.
 */
export function preloadWhiteNoiseSource(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();

    const revisionAtStart = sourceRevision;
    if (sourcePreloadPromise && sourcePreloadRevision === revisionAtStart) {
        return sourcePreloadPromise;
    }

    sourcePreloadRevision = revisionAtStart;
    const sourceAtStart = { ...source };
    const request = Promise.all(([0, 1] as const).map(index => {
        const audio = getPlayer(index);
        if (!audio) return Promise.resolve();
        setSource(audio, sourceAtStart);
        return preloadAudio(audio);
    })).then(() => undefined).catch(error => {
        console.warn('Could not preload Pomodoro white noise:', error);
    }).finally(() => {
        if (sourcePreloadPromise === request) {
            sourcePreloadPromise = null;
            sourcePreloadRevision = null;
        }
    });

    sourcePreloadPromise = request;
    return request;
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
 * Resolves the authenticated user's selected source without blocking player
 * creation. A fallback can start immediately while the private MP3 loads.
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
    const request = loadSelectedPomodoroSoundMetadata()
        .then(selectedSound => {
            const requestIsCurrent = sourceRevision === revisionAtStart && getAuthCacheScope() === scope;
            if (requestIsCurrent) {
                initializedSourceScope = scope;
                // Metadata is enough to finish initialization. Fetch the MP3
                // in the background and let a running timer move to it when
                // the authenticated audio URL becomes available.
                void getPomodoroSoundAudioUrl(selectedSound)
                    .then(url => {
                        if (sourceRevision === revisionAtStart && getAuthCacheScope() === scope) {
                            setWhiteNoiseSource({
                                id: selectedSound.id,
                                name: selectedSound.name,
                                url,
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Could not load the selected Pomodoro sound audio:', error);
                    });
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
    sourceSelectionRevision += 1;
    sourceRevision += 1;
    sourceOwnerScope = null;
    initializedSourceScope = null;
    sourceLoadScope = null;
    sourceLoadPromise = null;
    sourcePreloadRevision = null;
    sourcePreloadPromise = null;
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
    if (sourceUnchanged) {
        void preloadWhiteNoiseSource();
        return;
    }

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
        void preloadWhiteNoiseSource();
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

export function selectWhiteNoiseSound(sound: PomodoroSound): Promise<WhiteNoiseSource> {
    const scope = getAuthCacheScope();
    const revision = ++sourceSelectionRevision;
    // Prevent a slower startup request from applying an older database
    // preference after the user has already chosen a different sound.
    sourceRevision += 1;
    const previousSource = getWhiteNoiseSource();
    let audioLoaded = false;
    let preferenceSaved = scope === 'anonymous' || sound.id === previousSource.id;
    const audioRequest = getPomodoroSoundAudioUrl(sound).then(url => {
        audioLoaded = true;
        return url;
    });
    const preferenceRequest = preferenceSaved
        ? Promise.resolve()
        : userService.updatePreferences({ pomodoroSoundId: sound.id }).then(() => {
            preferenceSaved = true;
        });
    const switchRequest = audioRequest.then(url => {
        if (revision === sourceSelectionRevision && getAuthCacheScope() === scope) {
            setWhiteNoiseSource({ id: sound.id, name: sound.name, url });
        }
        return url;
    });

    return Promise.all([switchRequest, preferenceRequest])
        .then(() => getWhiteNoiseSource())
        .catch(async error => {
            if (revision !== sourceSelectionRevision || getAuthCacheScope() !== scope) {
                return getWhiteNoiseSource();
            }

            // Keep the audio and persisted preference aligned if one half of
            // the parallel change failed after the other half succeeded.
            let shouldRollBackPreference = preferenceSaved;
            if (!shouldRollBackPreference && scope !== 'anonymous' && sound.id !== previousSource.id) {
                try {
                    await preferenceRequest;
                    shouldRollBackPreference = true;
                } catch (preferenceError) {
                    // The original failure is the useful error for this selection.
                    console.error('Could not confirm the Pomodoro sound preference:', preferenceError);
                }
            }
            if (revision !== sourceSelectionRevision || getAuthCacheScope() !== scope) {
                return getWhiteNoiseSource();
            }
            if (audioLoaded && source.id === sound.id) {
                setWhiteNoiseSource(previousSource);
            }
            if (shouldRollBackPreference && scope !== 'anonymous' && sound.id !== previousSource.id) {
                try {
                    await userService.updatePreferences({ pomodoroSoundId: previousSource.id });
                } catch (rollbackError) {
                    console.error('Could not roll back the Pomodoro sound preference:', rollbackError);
                }
            }
            throw error;
        });
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
    // Starting playback must not wait for an authenticated MP3 download.
    // Initialization continues in the background and swaps the source when
    // it is ready.
    void initializeWhiteNoiseSource();
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
