export type AudioFeedbackKind =
  | 'taskCompleted'
  | 'eventCreated'
  | 'dayRatingHigh'
  | 'dayRatingLow'
  | 'statGood'
  | 'statBad'
  | 'mentalThreadCreated'
  | 'pomodoroFocusEnded'
  | 'pomodoroBreakEnded'
  | 'pomodoroCompleted';

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
const C3 = 130.81;
const E3 = 164.81;
const G3 = 196.0;
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
  // Soft descent: acknowledges a hard day without sounding like an error.
  dayRatingLow: [
    NOTE(A4, 0.12, { waveform: 'triangle', volume: 0.06 }),
    NOTE(F4, 0.12, { waveform: 'triangle', volume: 0.06 }),
    NOTE(D4, 0.22, { gapAfter: 0, waveform: 'triangle', volume: 0.07 }),
  ],
  // A warm, slightly unhurried rise for a value that lands on the good side.
  statGood: [
    NOTE(C5, 0.11, { volume: 0.065 }),
    NOTE(E5, 0.12, { volume: 0.075 }),
    NOTE(G5, 0.14, { volume: 0.085 }),
    NOTE(C6, 0.4, { gapAfter: 0, volume: 0.105 }),
  ],
  // A soft, minor-leaning descent that gives disappointment room to land.
  statBad: [
    NOTE(A4, 0.15, { waveform: 'sine', volume: 0.055 }),
    NOTE(F4, 0.16, { waveform: 'sine', volume: 0.05 }),
    NOTE(D4, 0.18, { waveform: 'sine', volume: 0.05 }),
    NOTE(C4, 0.36, { gapAfter: 0, waveform: 'sine', volume: 0.06 }),
  ],
  // An open, unfinished-feeling interval for capturing a thought.
  mentalThreadCreated: [
    NOTE(D4, 0.12, { waveform: 'triangle', volume: 0.06 }),
    NOTE(G4, 0.14, { waveform: 'triangle', volume: 0.065 }),
    NOTE(B4, 0.24, { gapAfter: 0, waveform: 'triangle', volume: 0.075 }),
  ],
  // A soft handoff cue for moving from focused work into a break.
  pomodoroFocusEnded: [
    NOTE(G4, 0.12, { waveform: 'triangle', volume: 0.06 }),
    NOTE(C5, 0.22, { gapAfter: 0, waveform: 'triangle', volume: 0.07 }),
  ],
  // A clear but unobtrusive cue for returning to focused work.
  pomodoroBreakEnded: [
    NOTE(C5, 0.11, { volume: 0.065 }),
    NOTE(G5, 0.22, { gapAfter: 0, volume: 0.075 }),
  ],
  // A resolved cadence for completing the full Pomodoro.
  pomodoroCompleted: [
    NOTE(C5, 0.1),
    NOTE(E5, 0.1),
    NOTE(G5, 0.1),
    NOTE(C6, 0.28, { gapAfter: 0, volume: 0.09 }),
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

interface ResonantPartial {
  ratio: number;
  level: number;
  waveform: 'sine' | 'triangle';
}

const RESONANT_BELL_PARTIALS: readonly ResonantPartial[] = [
  { ratio: 1, level: 1, waveform: 'sine' },
  { ratio: 2.01, level: 0.36, waveform: 'sine' },
  { ratio: 3.02, level: 0.18, waveform: 'triangle' },
  { ratio: 4.17, level: 0.09, waveform: 'sine' },
];

function renderResonantTone(
  context: AudioContextLike,
  start: number,
  frequency: number,
  duration: number,
  volume: number,
  destination: AudioNodeLike = context.destination,
): void {
  RESONANT_BELL_PARTIALS.forEach(partial => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const peak = volume * partial.level;
    const attackEnd = start + Math.min(0.035, duration * 0.08);
    const decayEnd = start + duration * 0.24;

    oscillator.type = partial.waveform;
    oscillator.frequency.setValueAtTime(frequency * partial.ratio, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, attackEnd);
    gain.gain.linearRampToValueAtTime(peak * 0.48, decayEnd);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}

/** A full-decay cue for the quiet boundaries inside a meditation. */
export function renderMeditationIntervalBell(
  context: AudioContextLike,
  when = context.currentTime + 0.01,
  destination: AudioNodeLike = context.destination,
): void {
  renderResonantTone(context, when, 293.66, 3.2, 0.12, destination);
}

interface GongMode {
  ratio: number;
  level: number;
  duration: number;
  pitchDrop: number;
}

const GONG_MODES: readonly GongMode[] = [
  { ratio: 0.78, level: 0.35, duration: 0.2, pitchDrop: 0.22 },
  { ratio: 0.5, level: 0.2, duration: 1.8, pitchDrop: 0.035 },
  { ratio: 1, level: 0.82, duration: 4.8, pitchDrop: 0.012 },
  { ratio: 1.48, level: 0.46, duration: 4.1, pitchDrop: 0.018 },
  { ratio: 2.08, level: 0.34, duration: 3.5, pitchDrop: 0.014 },
  { ratio: 2.77, level: 0.23, duration: 2.8, pitchDrop: 0.02 },
  { ratio: 3.63, level: 0.16, duration: 2.2, pitchDrop: 0.016 },
  { ratio: 4.72, level: 0.11, duration: 1.8, pitchDrop: 0.024 },
  { ratio: 6.11, level: 0.07, duration: 1.5, pitchDrop: 0.018 },
];

/** A struck, inharmonic low gong with a brief pitch bend and uneven decay. */
export function renderMeditationCompletionGong(context: AudioContextLike): void {
  const start = context.currentTime + 0.01;
  const fundamental = 130.81;

  GONG_MODES.forEach(mode => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const modeStart = start;
    const modeEnd = modeStart + mode.duration;
    const peak = 0.26 * mode.level;
    const earlyDecay = modeStart + Math.min(0.35, mode.duration * 0.22);
    const lateDecay = modeStart + mode.duration * 0.62;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(fundamental * mode.ratio * (1 + mode.pitchDrop), modeStart);
    oscillator.frequency.linearRampToValueAtTime(fundamental * mode.ratio, modeStart + 0.14);
    gain.gain.setValueAtTime(0, modeStart);
    gain.gain.linearRampToValueAtTime(peak, modeStart + 0.008);
    gain.gain.linearRampToValueAtTime(peak * 0.45, earlyDecay);
    gain.gain.linearRampToValueAtTime(peak * 0.12, lateDecay);
    gain.gain.linearRampToValueAtTime(0, modeEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(modeStart);
    oscillator.stop(modeEnd + 0.02);
  });
}
