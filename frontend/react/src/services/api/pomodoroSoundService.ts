import apiClient from '../utils/axiosConfig';
import { userService } from './userService';

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

export function clearPomodoroSoundCache(): void {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        audioUrlCache.forEach(url => URL.revokeObjectURL(url));
    }
    audioUrlCache.clear();
}

export async function getPomodoroSounds(): Promise<PomodoroSound[]> {
    const response = await apiClient.get<PomodoroSound[]>('/api/v1/users/me/pomodoro-sounds');
    return response.data;
}

export async function uploadPomodoroSound(file: File, onProgress?: (percent: number | null) => void): Promise<PomodoroSound> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<PomodoroSound>('/api/v1/users/me/pomodoro-sounds', formData, {
        // Remove the JSON default so the browser can add multipart/form-data with its boundary.
        headers: { 'Content-Type': null },
        onUploadProgress: progressEvent => {
            const total = progressEvent.total;
            onProgress?.(total ? Math.min(99, Math.round((progressEvent.loaded / total) * 100)) : 0);
        },
    });
    onProgress?.(100);
    // The selected sound can start immediately without downloading the same MP3 again.
    audioUrlCache.set(response.data.id, URL.createObjectURL(file));
    return response.data;
}

export async function deletePomodoroSound(soundId: string): Promise<void> {
    await apiClient.delete(`/api/v1/users/me/pomodoro-sounds/${soundId}`);
    const cachedUrl = audioUrlCache.get(soundId);
    if (cachedUrl) URL.revokeObjectURL(cachedUrl);
    audioUrlCache.delete(soundId);
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
