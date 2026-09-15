import apiClient from '../utils/axiosConfig';
import { userService } from './userService';
import { CachedResource } from '../cache/ttlCache';
import { getAuthCacheScope } from '../utils/authHeaders';

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

const audioUrlCache = new Map<string, string>();
const POMODORO_SOUND_LIST_TTL_MS = 5 * 60 * 1000;
const POMODORO_SOUND_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const POMODORO_SOUND_STORAGE_PREFIX = 'claritard:pomodoro-sounds:';
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
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        audioUrlCache.forEach(url => URL.revokeObjectURL(url));
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
    audioUrlCache.set(response.data.id, URL.createObjectURL(file));
    updateCachedPomodoroSounds(sounds => sounds.some(sound => sound.id === response.data.id)
        ? sounds
        : [...sounds, response.data]);
    return response.data;
}

export async function deletePomodoroSound(soundId: string): Promise<void> {
    await apiClient.delete(`/api/v1/users/me/pomodoro-sounds/${soundId}`);
    const cachedUrl = audioUrlCache.get(soundId);
    if (cachedUrl) URL.revokeObjectURL(cachedUrl);
    audioUrlCache.delete(soundId);
    updateCachedPomodoroSounds(sounds => sounds.filter(sound => sound.id !== soundId));
}

export async function getPomodoroSoundAudioUrl(sound: PomodoroSound): Promise<string> {
    if (sound.builtIn || sound.id === BUILT_IN_POMODORO_SOUND_ID) {
        return '/audio/brown-noise.mp3';
    }

    const cachedUrl = audioUrlCache.get(sound.id);
    if (cachedUrl) return cachedUrl;

    const response = await apiClient.get<Blob>(`/api/v1/users/me/pomodoro-sounds/${sound.id}/audio`, {
        responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    audioUrlCache.set(sound.id, url);
    return url;
}

export async function loadSelectedPomodoroSound(): Promise<{ id: string; name: string; url: string }> {
    const [preferences, uploadedSounds] = await Promise.all([
        userService.getPreferences(),
        getPomodoroSounds(),
    ]);
    const selectedId = preferences.pomodoroSoundId || BUILT_IN_POMODORO_SOUND_ID;
    const selectedSound = [BUILT_IN_POMODORO_SOUND, ...uploadedSounds]
        .find(sound => sound.id === selectedId) ?? BUILT_IN_POMODORO_SOUND;
    return {
        id: selectedSound.id,
        name: selectedSound.name,
        url: await getPomodoroSoundAudioUrl(selectedSound),
    };
}
