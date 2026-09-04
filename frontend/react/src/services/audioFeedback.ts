import {
    AUDIO_FEEDBACK_STORAGE_KEY,
    dayRatingFeedback,
    renderAudioFeedback,
    type AudioContextLike,
    type AudioFeedbackKind,
} from '../../../shared/audioFeedback.ts';

let audioContext: AudioContextLike | null = null;
let enabled = readEnabled();

function readEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    try {
        return window.localStorage.getItem(AUDIO_FEEDBACK_STORAGE_KEY) !== 'false';
    } catch (error) {
        console.warn('Could not read sound effects preference:', error);
        return true;
    }
}

function getAudioContext(): AudioContextLike | null {
    if (typeof window === 'undefined') return null;
    if (audioContext) return audioContext;

    const windowWithWebKitAudio = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = window.AudioContext ?? windowWithWebKitAudio.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    audioContext = new AudioContextConstructor() as unknown as AudioContextLike;
    return audioContext;
}

export function isAudioFeedbackEnabled(): boolean {
    return enabled;
}

export function setAudioFeedbackEnabled(nextEnabled: boolean): void {
    enabled = nextEnabled;
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(AUDIO_FEEDBACK_STORAGE_KEY, String(nextEnabled));
    } catch (error) {
        console.warn('Could not save sound effects preference:', error);
    }
}

/** Prime the browser audio context while a user gesture is still active. */
export function prepareAudioFeedback(): void {
    if (!enabled) return;
    const context = getAudioContext();
    if (context?.state === 'suspended') {
        void context.resume().catch(error => console.warn('Could not unlock sound effects:', error));
    }
}

export function playAudioFeedback(kind: AudioFeedbackKind): void {
    if (!enabled) return;
    const context = getAudioContext();
    if (!context) return;

    void (async () => {
        if (context.state === 'suspended') await context.resume();
        renderAudioFeedback(context, kind);
    })().catch(error => console.warn('Could not play sound effect:', error));
}

export { dayRatingFeedback };
