import apiClient from '../utils/axiosConfig';
import { userService } from './userService';
import { CachedResource } from '../cache/ttlCache';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { isDefinitiveRefreshFailure, redirectToSignIn, refreshAuthToken } from '../keycloak';

export const BUILT_IN_POMODORO_SOUND_ID = 'brown-noise';
export const BUILT_IN_POMODORO_SOUND = {
    id: BUILT_IN_POMODORO_SOUND_ID,
    name: 'Brown noise',
    fileSize: 0,
    builtIn: true,
} as const;
export const MAX_POMODORO_SOUND_SIZE_BYTES = 25 * 1024 * 1024;

export interface PomodoroSound {
    id: string;
    name: string;
    fileSize: number;
    builtIn?: boolean;
}

interface CachedAudioUrls {
    urls: string[];
    reusable: boolean;
}

interface StoredPomodoroAudio {
    key: string;
    audio: Blob;
}

const audioUrlCache = new Map<string, CachedAudioUrls>();
const audioUrlRequests = new Map<string, Promise<string[]>>();
const audioStreamControllers = new Map<string, AbortController>();
let audioCacheGeneration = 0;
const POMODORO_SOUND_LIST_TTL_MS = 5 * 60 * 1000;
const POMODORO_SOUND_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const POMODORO_SOUND_STORAGE_PREFIX = 'claritard:pomodoro-sounds:';
const POMODORO_AUDIO_DATABASE = 'claritard-audio-cache';
const POMODORO_AUDIO_STORE = 'pomodoro-sounds';
const POMODORO_AUDIO_TYPE = 'audio/mpeg';
const pomodoroSoundListCache = new CachedResource<PomodoroSound[]>({
    ttlMs: POMODORO_SOUND_LIST_TTL_MS,
    maxEntries: 4,
});

function pomodoroSoundListCacheKey(): string {
    return `${getAuthCacheScope()}:pomodoro-sounds`;
}

function pomodoroSoundStorageKey(cacheKey: string): string {
    return `${POMODORO_SOUND_STORAGE_PREFIX}${cacheKey}`;
}

function readPersistedPomodoroSounds(cacheKey: string): PomodoroSound[] | undefined {
    if (typeof window === 'undefined') return undefined;

    try {
        const raw = window.sessionStorage.getItem(pomodoroSoundStorageKey(cacheKey));
        if (!raw) return undefined;
        const snapshot = JSON.parse(raw) as { savedAt?: number; sounds?: PomodoroSound[] };
        if (!Array.isArray(snapshot.sounds)
            || typeof snapshot.savedAt !== 'number'
            || Date.now() - snapshot.savedAt > POMODORO_SOUND_SNAPSHOT_MAX_AGE_MS) {
            window.sessionStorage.removeItem(pomodoroSoundStorageKey(cacheKey));
            return undefined;
        }
        return snapshot.sounds;
    } catch (error) {
        console.warn('Could not read the cached Pomodoro sounds:', error);
        return undefined;
    }
}

function persistPomodoroSounds(cacheKey: string, sounds: PomodoroSound[]): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(pomodoroSoundStorageKey(cacheKey), JSON.stringify({
            savedAt: Date.now(),
            sounds,
        }));
    } catch (error) {
        console.warn('Could not persist the cached Pomodoro sounds:', error);
    }
}

export function clearPomodoroSoundCache(): void {
    audioCacheGeneration += 1;
    audioUrlRequests.clear();
    audioStreamControllers.forEach(controller => controller.abort());
    audioStreamControllers.clear();
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        audioUrlCache.forEach(entry => entry.urls.forEach(url => URL.revokeObjectURL(url)));
    }
    audioUrlCache.clear();
    if (typeof window !== 'undefined') {
        try {
            window.sessionStorage.removeItem(pomodoroSoundStorageKey(pomodoroSoundListCacheKey()));
        } catch (error) {
            console.warn('Could not clear the cached Pomodoro sounds:', error);
        }
    }
    pomodoroSoundListCache.clear();
}

export function getCachedPomodoroSounds(): PomodoroSound[] | undefined {
    const cacheKey = pomodoroSoundListCacheKey();
    return pomodoroSoundListCache.getStale(cacheKey) ?? readPersistedPomodoroSounds(cacheKey);
}

export async function getPomodoroSounds(): Promise<PomodoroSound[]> {
    const cacheKey = pomodoroSoundListCacheKey();
    const cached = pomodoroSoundListCache.getCached(cacheKey);
    if (cached) return cached;

    const stale = pomodoroSoundListCache.getStale(cacheKey);
    if (stale) {
        // Sound names are useful immediately, while the list can refresh in
        // the background without delaying the page or the sound menu.
        void refreshPomodoroSoundsInBackground(cacheKey);
        return stale;
    }

    const persisted = readPersistedPomodoroSounds(cacheKey);
    if (persisted) {
        // Persisted names are a render-time fallback. Keep the network request
        // independent so a cold page can paint before the refresh completes.
        void refreshPomodoroSoundsInBackground(cacheKey);
        return persisted;
    }

    return refreshPomodoroSounds(cacheKey);
}

function refreshPomodoroSounds(cacheKey: string): Promise<PomodoroSound[]> {
    return pomodoroSoundListCache.get(cacheKey, async () => {
        const response = await apiClient.get<PomodoroSound[]>('/api/v1/users/me/pomodoro-sounds');
        persistPomodoroSounds(cacheKey, response.data);
        return response.data;
    });
}

function refreshPomodoroSoundsInBackground(cacheKey: string): Promise<void> {
    return refreshPomodoroSounds(cacheKey).then(() => undefined).catch(error => {
        console.warn('Could not refresh the cached Pomodoro sounds:', error);
    });
}

function updateCachedPomodoroSounds(update: (sounds: PomodoroSound[]) => PomodoroSound[]): void {
    const cacheKey = pomodoroSoundListCacheKey();
    const cached = pomodoroSoundListCache.getStale(cacheKey) ?? readPersistedPomodoroSounds(cacheKey);
    if (cached) {
        const updated = update(cached);
        pomodoroSoundListCache.set(cacheKey, updated);
        persistPomodoroSounds(cacheKey, updated);
    }
}

export async function uploadPomodoroSound(
    file: File,
    onProgress?: (percent: number | null) => void,
    signal?: AbortSignal,
): Promise<PomodoroSound> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<PomodoroSound>('/api/v1/users/me/pomodoro-sounds', formData, {
        // Remove the JSON default so the browser can add multipart/form-data with its boundary.
        headers: { 'Content-Type': null },
        signal,
        onUploadProgress: progressEvent => {
            const total = progressEvent.total;
            onProgress?.(total ? Math.min(99, Math.round((progressEvent.loaded / total) * 100)) : 0);
        },
    });
    onProgress?.(100);
    // The selected sound can start immediately without downloading the same MP3 again.
    const cacheKey = audioCacheKey(response.data.id);
    audioUrlCache.set(cacheKey, { urls: [URL.createObjectURL(file)], reusable: true });
    void persistAudioBlob(cacheKey, file);
    updateCachedPomodoroSounds(sounds => sounds.some(sound => sound.id === response.data.id)
        ? sounds
        : [...sounds, response.data]);
    return response.data;
}

export async function deletePomodoroSound(soundId: string): Promise<void> {
    await apiClient.delete(`/api/v1/users/me/pomodoro-sounds/${soundId}`);
    const cacheKey = audioCacheKey(soundId);
    const cachedUrls = audioUrlCache.get(cacheKey);
    cachedUrls?.urls.forEach(url => URL.revokeObjectURL(url));
    audioUrlCache.delete(cacheKey);
    audioUrlRequests.forEach((_, requestKey) => {
        if (requestKey.startsWith(`${cacheKey}:`)) audioUrlRequests.delete(requestKey);
    });
    audioStreamControllers.forEach((controller, requestKey) => {
        if (requestKey.startsWith(`${cacheKey}:`)) {
            controller.abort();
            audioStreamControllers.delete(requestKey);
        }
    });
    await deleteStoredAudio(cacheKey);
    updateCachedPomodoroSounds(sounds => sounds.filter(sound => sound.id !== soundId));
}

export async function getPomodoroSoundAudioUrl(sound: PomodoroSound): Promise<string> {
    return (await getPomodoroSoundAudioUrls(sound, 1))[0];
}

/** Return independent stream URLs for layered players, sharing one network read. */
export async function getPomodoroSoundAudioUrls(sound: PomodoroSound, consumers = 1): Promise<string[]> {
    const count = Math.max(1, Math.floor(consumers));
    if (sound.builtIn || sound.id === BUILT_IN_POMODORO_SOUND_ID) {
        return Array.from({ length: count }, () => '/audio/brown-noise.mp3');
    }

    const cacheKey = audioCacheKey(sound.id);
    const cachedUrl = audioUrlCache.get(cacheKey);
    if (cachedUrl && (cachedUrl.reusable || cachedUrl.urls.length >= count)) {
        return cachedUrl.reusable
            ? Array.from({ length: count }, () => cachedUrl.urls[0])
            : cachedUrl.urls.slice(0, count);
    }

    const storedAudio = await readStoredAudio(cacheKey);
    if (storedAudio) {
        const url = URL.createObjectURL(storedAudio);
        audioUrlCache.set(cacheKey, { urls: [url], reusable: true });
        return Array.from({ length: count }, () => url);
    }

    const requestKey = `${cacheKey}:${count}`;
    const pendingRequest = audioUrlRequests.get(requestKey);
    if (pendingRequest) return pendingRequest;

    const generation = audioCacheGeneration;
    const request = canStreamMp3()
        ? streamPomodoroAudio(cacheKey, sound.id, count, generation).catch(error => {
            console.warn('Progressive Pomodoro playback is unavailable; downloading the clip instead:', error);
            return downloadPomodoroAudio(cacheKey, sound.id, generation).then(url =>
                Array.from({ length: count }, () => url));
        })
        : downloadPomodoroAudio(cacheKey, sound.id, generation).then(url =>
            Array.from({ length: count }, () => url));
    const trackedRequest = request.then(urls => {
        if (generation !== audioCacheGeneration) {
            if (audioUrlCache.get(cacheKey)?.urls === urls) audioUrlCache.delete(cacheKey);
            urls.forEach(url => URL.revokeObjectURL(url));
            throw new Error('Pomodoro sound cache was cleared.');
        }
        return urls;
    }).finally(() => {
        if (audioUrlRequests.get(requestKey) === trackedRequest) audioUrlRequests.delete(requestKey);
    });

    audioUrlRequests.set(requestKey, trackedRequest);
    return trackedRequest;
}

/** Start downloading a sound before the user selects it from the menu. */
export async function preloadPomodoroSoundAudio(sound: PomodoroSound): Promise<void> {
    if (sound.builtIn || sound.id === BUILT_IN_POMODORO_SOUND_ID) return;

    const cacheKey = audioCacheKey(sound.id);
    if (audioUrlCache.get(cacheKey)?.reusable || await readStoredAudio(cacheKey)) return;
    if ([...audioStreamControllers.keys()].some(requestKey => requestKey.startsWith(`${cacheKey}:`))) return;
    await downloadPomodoroAudio(cacheKey, sound.id, audioCacheGeneration);
}

function canStreamMp3(): boolean {
    try {
        return typeof window !== 'undefined'
            && typeof window.MediaSource !== 'undefined'
            && window.MediaSource.isTypeSupported(POMODORO_AUDIO_TYPE);
    } catch (error) {
        console.warn('Could not check progressive Pomodoro playback support:', error);
        return false;
    }
}

async function getPomodoroAudioResponse(soundId: string, signal?: AbortSignal): Promise<Response> {
    try {
        await refreshAuthToken(30);
    } catch (error) {
        if (isDefinitiveRefreshFailure(error)) {
            redirectToSignIn();
            throw error;
        }
        // A temporary identity-provider outage should still allow the existing token to be used.
        console.warn('Could not refresh the session before loading Pomodoro audio:', error);
    }

    const path = `/api/v1/users/me/pomodoro-sounds/${soundId}/audio`;
    const response = await fetch(apiClient.getUri({ url: path }), {
        headers: getAuthHeaders(),
        signal,
    });
    if (!response.ok) throw new Error(`Pomodoro sound request failed (${response.status}).`);
    return response;
}

async function downloadPomodoroAudio(cacheKey: string, soundId: string, generation: number): Promise<string> {
    const response = await getPomodoroAudioResponse(soundId);
    const audio = await response.blob();
    const url = URL.createObjectURL(audio);
    if (generation !== audioCacheGeneration) {
        URL.revokeObjectURL(url);
        throw new Error('Pomodoro sound cache was cleared.');
    }
    audioUrlCache.set(cacheKey, { urls: [url], reusable: true });
    void persistAudioBlob(cacheKey, audio);
    return url;
}

async function streamPomodoroAudio(
    cacheKey: string,
    soundId: string,
    consumers: number,
    generation: number,
): Promise<string[]> {
    const requestKey = `${cacheKey}:${consumers}`;
    const controller = new AbortController();
    const mediaSources = Array.from({ length: consumers }, () => new MediaSource());
    const urls = mediaSources.map(mediaSource => URL.createObjectURL(mediaSource));
    const chunks: Uint8Array[] = [];
    const sourceBuffers: (SourceBuffer | undefined)[] = Array.from({ length: consumers });
    const queuedChunks: Uint8Array[][] = Array.from({ length: consumers }, () => []);
    const appendChains: Promise<void>[] = Array.from({ length: consumers }, () => Promise.resolve());
    let streamFinished = false;
    const sourceBufferPromises = mediaSources.map((mediaSource, index) =>
        openMp3SourceBuffer(mediaSource, controller.signal).then(sourceBuffer => {
            sourceBuffers[index] = sourceBuffer;
            const previousAppends = appendChains[index];
            const initialChunks = queuedChunks[index].splice(0);
            const replay = previousAppends.then(async () => {
                for (const chunk of initialChunks) await appendAudioChunk(sourceBuffer, chunk);
            });
            appendChains[index] = replay;
            return replay.then(() => {
                if (streamFinished) endMediaSource(mediaSource);
                return sourceBuffer;
            });
        }));
    const anySourceBufferReady = new Promise<void>((resolve, reject) => {
        let failedBuffers = 0;
        sourceBufferPromises.forEach(promise => {
            promise.then(() => resolve()).catch(error => {
                failedBuffers += 1;
                if (failedBuffers === consumers) reject(error);
            });
        });
    });

    const stream = (async () => {
        try {
            // sourceopen fires only after the returned URL is attached to a media element.
            // Do not wait for it before handing the URL to the player.
            await anySourceBufferReady;
            const response = await getPomodoroAudioResponse(soundId, controller.signal);
            if (!response.body) throw new Error('Pomodoro audio streaming is unavailable.');

            const reader = response.body.getReader();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value?.byteLength) continue;
                chunks.push(value);
                const pendingAppends = sourceBuffers.map((sourceBuffer, index) => {
                    if (!sourceBuffer) {
                        queuedChunks[index].push(value);
                        return Promise.resolve();
                    }
                    const nextAppend = appendChains[index].then(() => appendAudioChunk(sourceBuffer, value));
                    appendChains[index] = nextAppend;
                    return nextAppend;
                });
                await Promise.all(pendingAppends);
            }

            if (chunks.length === 0) throw new Error('The Pomodoro sound file was empty.');
            if (generation === audioCacheGeneration) {
                const audio = new Blob(chunks, { type: POMODORO_AUDIO_TYPE });
                void persistAudioBlob(cacheKey, audio);
            }
            streamFinished = true;
            await Promise.all(sourceBuffers.map((sourceBuffer, index) => sourceBuffer
                ? appendChains[index].then(() => endMediaSource(mediaSources[index]))
                : Promise.resolve()));
        } catch (error) {
            const streamError = error instanceof Error ? error : new Error('Pomodoro audio could not be streamed.');
            if (!controller.signal.aborted) {
                console.error('Could not stream Pomodoro audio:', streamError);
                if (audioUrlCache.get(cacheKey)?.urls === urls) audioUrlCache.delete(cacheKey);
                urls.forEach(url => URL.revokeObjectURL(url));
            }
            mediaSources.forEach(mediaSource => endMediaSource(mediaSource, 'network'));
        } finally {
            if (audioStreamControllers.get(requestKey) === controller) {
                audioStreamControllers.delete(requestKey);
            }
        }
    })();

    audioStreamControllers.set(requestKey, controller);
    audioUrlCache.set(cacheKey, { urls, reusable: false });
    // Playback can start as soon as the first media segment arrives; the remaining bytes
    // continue downloading and are written to IndexedDB after the response completes.
    void stream;
    return urls;
}

function endMediaSource(mediaSource: MediaSource, error?: 'network' | 'decode'): void {
    if (mediaSource.readyState !== 'open') return;
    try {
        mediaSource.endOfStream(error);
    } catch (endError) {
        console.warn('Could not close the Pomodoro audio stream:', endError);
    }
}

function openMp3SourceBuffer(mediaSource: MediaSource, signal: AbortSignal): Promise<SourceBuffer> {
    return new Promise((resolve, reject) => {
        const onAbort = () => finish(new Error('Pomodoro audio stream was cancelled.'));
        const onOpen = () => {
            cleanup();
            try {
                resolve(mediaSource.addSourceBuffer(POMODORO_AUDIO_TYPE));
            } catch (error) {
                reject(error instanceof Error ? error : new Error('MP3 playback is unavailable.'));
            }
        };
        const onClose = () => {
            finish(new Error('MP3 playback could not be initialized.'));
        };
        const cleanup = () => {
            mediaSource.removeEventListener('sourceopen', onOpen);
            mediaSource.removeEventListener('sourceclose', onClose);
            signal.removeEventListener('abort', onAbort);
        };
        const finish = (error: Error) => {
            cleanup();
            reject(error);
        };

        if (signal.aborted) {
            finish(new Error('Pomodoro audio stream was cancelled.'));
            return;
        }
        if (mediaSource.readyState === 'open') {
            onOpen();
            return;
        }
        mediaSource.addEventListener('sourceopen', onOpen, { once: true });
        mediaSource.addEventListener('sourceclose', onClose, { once: true });
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

function appendAudioChunk(sourceBuffer: SourceBuffer, chunk: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
        const onUpdateEnd = () => finish();
        const onError = () => finish(new Error('MP3 playback could not decode an audio segment.'));
        const finish = (error?: Error) => {
            sourceBuffer.removeEventListener('updateend', onUpdateEnd);
            sourceBuffer.removeEventListener('error', onError);
            if (error) reject(error);
            else resolve();
        };

        sourceBuffer.addEventListener('updateend', onUpdateEnd, { once: true });
        sourceBuffer.addEventListener('error', onError, { once: true });
        try {
            sourceBuffer.appendBuffer(chunk);
        } catch (error) {
            finish(error instanceof Error ? error : new Error('MP3 playback could not append an audio segment.'));
        }
    });
}

function audioDatabase(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);

    return new Promise(resolve => {
        try {
            const request = indexedDB.open(POMODORO_AUDIO_DATABASE, 1);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(POMODORO_AUDIO_STORE)) {
                    database.createObjectStore(POMODORO_AUDIO_STORE, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                console.warn('Could not open the local Pomodoro audio cache:', request.error);
                resolve(null);
            };
            request.onblocked = () => resolve(null);
        } catch (error) {
            console.warn('Could not open the local Pomodoro audio cache:', error);
            resolve(null);
        }
    });
}

async function readStoredAudio(cacheKey: string): Promise<Blob | undefined> {
    const database = await audioDatabase();
    if (!database) return undefined;

    return new Promise(resolve => {
        try {
            const transaction = database.transaction(POMODORO_AUDIO_STORE, 'readonly');
            const request = transaction.objectStore(POMODORO_AUDIO_STORE).get(cacheKey);
            request.onsuccess = () => resolve((request.result as StoredPomodoroAudio | undefined)?.audio);
            request.onerror = () => {
                console.warn('Could not read a locally cached Pomodoro sound:', request.error);
                resolve(undefined);
            };
            transaction.oncomplete = () => database.close();
            transaction.onerror = () => database.close();
        } catch (error) {
            console.warn('Could not read a locally cached Pomodoro sound:', error);
            database.close();
            resolve(undefined);
        }
    });
}

async function persistAudioBlob(cacheKey: string, audio: Blob): Promise<void> {
    const database = await audioDatabase();
    if (!database) return;

    return new Promise(resolve => {
        try {
            const transaction = database.transaction(POMODORO_AUDIO_STORE, 'readwrite');
            transaction.objectStore(POMODORO_AUDIO_STORE).put({ key: cacheKey, audio } satisfies StoredPomodoroAudio);
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onerror = () => {
                console.warn('Could not save a Pomodoro sound for offline playback:', transaction.error);
                database.close();
                resolve();
            };
            transaction.onabort = () => {
                console.warn('Could not save a Pomodoro sound for offline playback:', transaction.error);
                database.close();
                resolve();
            };
        } catch (error) {
            console.warn('Could not save a Pomodoro sound for offline playback:', error);
            database.close();
            resolve();
        }
    });
}

async function deleteStoredAudio(cacheKey: string): Promise<void> {
    const database = await audioDatabase();
    if (!database) return;

    return new Promise(resolve => {
        try {
            const transaction = database.transaction(POMODORO_AUDIO_STORE, 'readwrite');
            transaction.objectStore(POMODORO_AUDIO_STORE).delete(cacheKey);
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onerror = () => {
                console.warn('Could not remove a deleted Pomodoro sound from local storage:', transaction.error);
                database.close();
                resolve();
            };
            transaction.onabort = () => {
                console.warn('Could not remove a deleted Pomodoro sound from local storage:', transaction.error);
                database.close();
                resolve();
            };
        } catch (error) {
            console.warn('Could not remove a deleted Pomodoro sound from local storage:', error);
            database.close();
            resolve();
        }
    });
}

function audioCacheKey(soundId: string): string {
    return `${getAuthCacheScope()}:${soundId}`;
}

export async function loadSelectedPomodoroSound(): Promise<{ id: string; name: string; url: string }> {
    const selectedSound = await loadSelectedPomodoroSoundMetadata();
    return {
        id: selectedSound.id,
        name: selectedSound.name,
        url: await getPomodoroSoundAudioUrl(selectedSound),
    };
}

export async function loadSelectedPomodoroSoundMetadata(): Promise<PomodoroSound> {
    const [preferences, uploadedSounds] = await Promise.all([
        userService.getPreferences(),
        getPomodoroSounds(),
    ]);
    const selectedId = preferences.pomodoroSoundId || BUILT_IN_POMODORO_SOUND_ID;
    const selected = [BUILT_IN_POMODORO_SOUND, ...uploadedSounds]
        .find(sound => sound.id === selectedId);
    if (selected) return selected;
    const refreshed = (await apiClient.get<PomodoroSound[]>('/api/v1/users/me/pomodoro-sounds')).data;
    pomodoroSoundListCache.set(pomodoroSoundListCacheKey(), refreshed);
    const current = refreshed.find(sound => sound.id === selectedId);
    if (!current) throw new Error('The selected focus sound is unavailable.');
    return current;
}
