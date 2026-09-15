import axios from 'axios';
import {
    getPomodoroSoundAudioUrl,
    PomodoroSound,
    uploadPomodoroSound,
} from './api/pomodoroSoundService';
import { userService } from './api/userService';
import { setWhiteNoiseSource } from './whiteNoise';

export type PomodoroSoundUploadPhase = 'idle' | 'uploading' | 'saving' | 'completed' | 'failed';

export interface PomodoroSoundUploadSnapshot {
    phase: PomodoroSoundUploadPhase;
    fileName: string | null;
    progress: number | null;
    sound: PomodoroSound | null;
    error: string | null;
}

const IDLE_SNAPSHOT: PomodoroSoundUploadSnapshot = {
    phase: 'idle',
    fileName: null,
    progress: null,
    sound: null,
    error: null,
};

// Keep the operation outside SettingsPage so route changes do not abort it or discard its progress.
let snapshot = IDLE_SNAPSHOT;
let activeUpload: { id: symbol; controller: AbortController } | null = null;
const listeners = new Set<() => void>();

export function getPomodoroSoundUploadSnapshot(): PomodoroSoundUploadSnapshot {
    return snapshot;
}

export function subscribeToPomodoroSoundUpload(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function isPomodoroSoundUploadActive(upload: PomodoroSoundUploadSnapshot = snapshot): boolean {
    return upload.phase === 'uploading' || upload.phase === 'saving';
}

export function isPomodoroSoundUploadCancellation(error: unknown): boolean {
    return axios.isCancel(error) || (error instanceof Error && error.name === 'AbortError');
}

export function cancelPomodoroSoundUpload(): void {
    if (activeUpload && snapshot.phase === 'uploading') {
        activeUpload.controller.abort();
    }
}

export function clearPomodoroSoundUploadResult(): void {
    if (!activeUpload && snapshot.phase !== 'idle') publish(IDLE_SNAPSHOT);
}

export function startPomodoroSoundUpload(file: File): Promise<PomodoroSound> {
    if (activeUpload) {
        return Promise.reject(new Error('A Pomodoro sound is already uploading.'));
    }

    const controller = new AbortController();
    const operationId = Symbol('pomodoro-sound-upload');
    let uploadedSound: PomodoroSound | null = null;

    publish({
        phase: 'uploading',
        fileName: file.name,
        progress: 0,
        sound: null,
        error: null,
    });

    const operation = uploadPomodoroSound(
        file,
        progress => publish({
            phase: 'uploading',
            fileName: file.name,
            progress,
            sound: uploadedSound,
            error: null,
        }),
        controller.signal,
    )
        .then(async sound => {
            if (controller.signal.aborted) {
                const cancellation = new Error('Pomodoro sound upload canceled.');
                cancellation.name = 'AbortError';
                throw cancellation;
            }
            uploadedSound = sound;
            publish({
                phase: 'saving',
                fileName: file.name,
                progress: 100,
                sound,
                error: null,
            });

            await userService.updatePreferences({ pomodoroSoundId: sound.id });
            const url = await getPomodoroSoundAudioUrl(sound);
            setWhiteNoiseSource({ id: sound.id, name: sound.name, url });
            publish({
                phase: 'completed',
                fileName: file.name,
                progress: 100,
                sound,
                error: null,
            });
            return sound;
        })
        .catch(error => {
            if (controller.signal.aborted || isPomodoroSoundUploadCancellation(error)) {
                publish(IDLE_SNAPSHOT);
            } else {
                console.error('Failed to finish Pomodoro sound upload:', error);
                publish({
                    phase: 'failed',
                    fileName: file.name,
                    progress: uploadedSound ? 100 : snapshot.progress,
                    sound: uploadedSound,
                    error: 'Could not upload that MP3 right now.',
                });
            }
            throw error;
        })
        .finally(() => {
            if (activeUpload?.id === operationId) activeUpload = null;
        });

    activeUpload = { id: operationId, controller };
    return operation;
}

function publish(nextSnapshot: PomodoroSoundUploadSnapshot): void {
    snapshot = nextSnapshot;
    listeners.forEach(listener => listener());
}
