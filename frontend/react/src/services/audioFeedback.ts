import {
    dayRatingFeedback,
    renderAudioFeedback,
    renderMeditationCompletionGong,
    renderMeditationIntervalBell,
    type AudioContextLike,
    type AudioFeedbackKind,
} from '../../../shared/audioFeedback.ts';
import { getRuntimeUserPreference, subscribeToUserPreferences, updateRuntimeUserPreferences } from './userPreferenceStore';

let audioContext: AudioContextLike | null = null;
let enabled = getRuntimeUserPreference('soundEffectsEnabled');
subscribeToUserPreferences(() => {
    enabled = getRuntimeUserPreference('soundEffectsEnabled');
});

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
    updateRuntimeUserPreferences({ soundEffectsEnabled: nextEnabled });
}

function isMeditationSoundPreviewGesture(event: Event | undefined): boolean {
    if (!event || typeof Element === 'undefined' || !(event.target instanceof Element)) return false;
    return Boolean(event.target.closest('[data-meditation-sound-preview]'));
}

/** Prime the browser audio context while a user gesture is still active. */
export function prepareAudioFeedback(event?: Event): void {
    // Let direct HTML audio previews keep the browser's user-activation token.
    if (isMeditationSoundPreviewGesture(event)) return;
    if (!enabled) return;
    const context = getAudioContext();
    if (context?.state === 'suspended') {
        void context.resume().catch(error => console.warn('Could not unlock sound effects:', error));
    }
}

/** Unlock the meditation gong from the start button, even when general UI sounds are disabled. */
export function prepareMeditationAudio(): void {
    const context = getAudioContext();
    if (context?.state === 'suspended') {
        void context.resume().catch(error => console.warn('Could not unlock meditation audio:', error));
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

function playMeditationCue(render: (context: AudioContextLike) => void, respectPreference = true): void {
    if (respectPreference && !enabled) return;
    const context = getAudioContext();
    if (!context) return;

    void (async () => {
        if (context.state === 'suspended') await context.resume();
        render(context);
    })().catch(error => console.warn('Could not play meditation cue:', error));
}

export function playMeditationIntervalBell(): void {
    playMeditationCue(renderMeditationIntervalBell);
}

export function playMeditationCompletionGong(): void {
    playMeditationCue(renderMeditationCompletionGong, false);
}

export { dayRatingFeedback };
