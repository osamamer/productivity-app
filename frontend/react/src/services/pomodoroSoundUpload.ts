import axios from 'axios';
import {
    PomodoroSound,
    uploadPomodoroSound,
} from './api/pomodoroSoundService';
import { selectWhiteNoiseSound } from './whiteNoise';

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

export function getPomodoroSoundUploadErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (error.response?.status === 413) {
            return 'That MP3 is too large. Choose a file that is 25 MB or smaller.';
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
            return 'Your session has expired. Sign in again and retry the upload.';
        }
        if (error.response?.status && error.response.status >= 500) {
            return 'The sound could not be stored right now. Please try again.';
        }
        if (typeof error.response?.data === 'string') {
            const message = error.response.data.trim();
            if (message === 'Choose an MP3 file to upload.'
                || message === 'MP3 files must be 25 MB or smaller.'
                || message === 'Only MP3 files can be uploaded.'
                || message === 'You can store up to 10 Pomodoro sounds.') {
                return message;
            }
        }
    }
    return 'Could not upload that MP3 right now. Please try again.';
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
        .then(sound => {
            if (controller.signal.aborted) {
                const cancellation = new Error('Pomodoro sound upload canceled.');
                cancellation.name = 'AbortError';
                throw cancellation;
            }
            uploadedSound = sound;
            publish({
                phase: 'completed',
                fileName: file.name,
                progress: 100,
                sound,
                error: null,
            });

            // The file is accepted as soon as the upload endpoint has stored
            // it. Preference persistence and audio loading continue in the
            // background so neither can turn a successful upload into a false
            // upload failure or block the settings UI.
            void selectWhiteNoiseSound(sound).catch(error => {
                console.error('Could not select the newly uploaded Pomodoro sound:', error);
                if (snapshot.phase === 'completed' && snapshot.sound?.id === sound.id) {
                    publish({
                        ...snapshot,
                        error: 'Sound uploaded, but it could not be selected. Choose it from the list to retry.',
                    });
                }
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
                    error: getPomodoroSoundUploadErrorMessage(error),
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
