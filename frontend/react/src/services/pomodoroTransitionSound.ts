import type { ApplicationNotification } from '../types/ApplicationNotification';

type PomodoroTransitionType = Extract<
    ApplicationNotification['type'],
    'POMODORO_FOCUS_ENDED' | 'POMODORO_BREAK_ENDED' | 'POMODORO_COMPLETED'
>;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
    audioContext ??= new window.AudioContext();
    return audioContext;
}

export function primePomodoroTransitionSound(): void {
    try {
        const context = getAudioContext();
        if (context && context.state !== 'running') {
            void context.resume().catch(error => {
                console.error('Could not prepare Pomodoro transition sound:', error);
            });
        }
    } catch (error) {
        console.error('Could not prepare Pomodoro transition sound:', error);
    }
}

function isPomodoroTransition(type: ApplicationNotification['type']): type is PomodoroTransitionType {
    return type === 'POMODORO_FOCUS_ENDED'
        || type === 'POMODORO_BREAK_ENDED'
        || type === 'POMODORO_COMPLETED';
}

export function playPomodoroTransitionSound(type: ApplicationNotification['type']): void {
    if (!isPomodoroTransition(type)) return;

    try {
        const context = audioContext;
        if (!context || context.state !== 'running') return;

        const notes = type === 'POMODORO_COMPLETED'
            ? [523.25, 659.25, 783.99]
            : type === 'POMODORO_FOCUS_ENDED'
                ? [659.25, 783.99]
                : [783.99, 659.25];
        const noteDuration = 0.18;
        const noteGap = 0.055;
        const startAt = context.currentTime + 0.015;

        notes.forEach((frequency, index) => {
            const noteStart = startAt + index * (noteDuration + noteGap);
            const oscillator = context.createOscillator();
            const volume = context.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, noteStart);
            volume.gain.setValueAtTime(0.0001, noteStart);
            volume.gain.linearRampToValueAtTime(0.12, noteStart + 0.025);
            volume.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration);
            oscillator.connect(volume);
            volume.connect(context.destination);
            oscillator.start(noteStart);
            oscillator.stop(noteStart + noteDuration);
        });
    } catch (error) {
        console.error('Could not play Pomodoro transition sound:', error);
    }
}
