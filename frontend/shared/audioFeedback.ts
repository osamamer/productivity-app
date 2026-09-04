export type AudioFeedbackKind =
  | 'taskCompleted'
  | 'eventCreated'
  | 'dayRatingHigh'
  | 'dayRatingLow'
  | 'mentalThreadCreated';

export const AUDIO_FEEDBACK_STORAGE_KEY = 'claritard.audio-feedback-enabled';

export interface AudioFeedbackNote {
  frequency: number;
  duration: number;
  gapAfter?: number;
  volume?: number;
  waveform?: 'sine' | 'triangle';
}

const C4 = 261.63;
const D4 = 293.66;
const F4 = 349.23;
const G4 = 392.0;
const A4 = 440.0;
const B4 = 493.88;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const NOTE = (frequency: number, duration: number, options: Omit<AudioFeedbackNote, 'frequency' | 'duration'> = {}): AudioFeedbackNote => ({
  frequency,
  duration,
  gapAfter: 0.025,
  volume: 0.075,
  waveform: 'sine',
  ...options,
});

export const AUDIO_FEEDBACK_SOUNDS: Record<AudioFeedbackKind, readonly AudioFeedbackNote[]> = {
  // A small rising chime: finishing should feel rewarding without becoming noisy.
  taskCompleted: [
    NOTE(C5, 0.1),
    NOTE(E5, 0.1),
    NOTE(G5, 0.18, { gapAfter: 0, volume: 0.09 }),
  ],
  // A warmer two-note cue that distinguishes putting something on the calendar.
  eventCreated: [
    NOTE(G4, 0.13, { waveform: 'triangle', volume: 0.065 }),
    NOTE(C5, 0.24, { gapAfter: 0, waveform: 'triangle', volume: 0.08 }),
  ],
  // Bright, resolved cadence for a day that feels good.
  dayRatingHigh: [
    NOTE(C5, 0.09),
    NOTE(E5, 0.09),
    NOTE(G5, 0.09),
    NOTE(C6, 0.25, { gapAfter: 0, volume: 0.085 }),
  ],
  // Gentle descent: acknowledges a hard day without sounding like an error.
  dayRatingLow: [
    NOTE(A4, 0.12, { waveform: 'triangle', volume: 0.06 }),
    NOTE(F4, 0.12, { waveform: 'triangle', volume: 0.06 }),
    NOTE(D4, 0.22, { gapAfter: 0, waveform: 'triangle', volume: 0.07 }),
  ],
  // An open, unfinished-feeling interval for capturing a thought.
  mentalThreadCreated: [
    NOTE(D4, 0.12, { waveform: 'triangle', volume: 0.06 }),
    NOTE(G4, 0.14, { waveform: 'triangle', volume: 0.065 }),
    NOTE(B4, 0.24, { gapAfter: 0, waveform: 'triangle', volume: 0.075 }),
  ],
};

export function dayRatingFeedback(rating: number, maximumRating: number): AudioFeedbackKind | null {
  if (!Number.isFinite(rating) || !Number.isFinite(maximumRating) || maximumRating <= 0) return null;

  const normalized = rating / maximumRating;
  if (normalized >= 0.7) return 'dayRatingHigh';
  if (normalized <= 0.3) return 'dayRatingLow';
  return null;
}

interface AudioParamLike {
  setValueAtTime(value: number, startTime: number): AudioParamLike;
  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike;
}

interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}

interface OscillatorNodeLike extends AudioNodeLike {
  frequency: AudioParamLike;
  type: 'sine' | 'triangle';
  start(when?: number): void;
  stop(when?: number): void;
}

interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface AudioContextLike {
  currentTime: number;
  destination: AudioNodeLike;
  state: string;
  resume(): Promise<void>;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
}

/**
 * Render a short pattern against either a browser or native Web Audio context.
 * Keeping scheduling here prevents the two clients from drifting musically.
 */
export function renderAudioFeedback(context: AudioContextLike, kind: AudioFeedbackKind): void {
  const start = context.currentTime + 0.01;
  let offset = 0;

  AUDIO_FEEDBACK_SOUNDS[kind].forEach(note => {
    const noteStart = start + offset;
    const noteEnd = noteStart + note.duration;
    const attackEnd = noteStart + Math.min(0.018, note.duration * 0.25);
    const releaseStart = noteEnd - Math.min(0.045, note.duration * 0.35);
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = note.waveform ?? 'sine';
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(note.volume ?? 0.075, attackEnd);
    gain.gain.setValueAtTime(note.volume ?? 0.075, releaseStart);
    gain.gain.linearRampToValueAtTime(0, noteEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.01);

    offset += note.duration + (note.gapAfter ?? 0);
  });
}
