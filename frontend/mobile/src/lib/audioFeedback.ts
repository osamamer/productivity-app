import {
  dayRatingFeedback,
  renderAudioFeedback,
  type AudioContextLike,
  type AudioFeedbackKind,
} from '../../../shared/audioFeedback';

type AudioModule = typeof import('react-native-audio-api');
type NativeAudioContext = InstanceType<AudioModule['AudioContext']>;

let audioModulePromise: Promise<AudioModule | null> | null = null;
let audioContext: NativeAudioContext | null = null;
let enabled = true;

async function loadAudioModule(): Promise<AudioModule | null> {
  if (!audioModulePromise) {
    audioModulePromise = import('react-native-audio-api').catch(error => {
      // Expo Go and development builds created before this native module was installed
      // cannot render synthesized UI sounds. The rest of the app remains usable.
      console.warn('Sound effects are unavailable in this native build.', error);
      return null;
    });
  }
  return audioModulePromise;
}

async function getAudioContext(): Promise<NativeAudioContext | null> {
  if (audioContext) return audioContext;

  const audioModule = await loadAudioModule();
  if (!audioModule) return null;

  try {
    audioContext = new audioModule.AudioContext();
    return audioContext;
  } catch (error) {
    console.warn('Could not initialize sound effects:', error);
    return null;
  }
}

export function isAudioFeedbackEnabled(): boolean {
  return enabled;
}

export function setAudioFeedbackEnabled(nextEnabled: boolean): void {
  enabled = nextEnabled;
}

export function playAudioFeedback(kind: AudioFeedbackKind): void {
  if (!enabled) return;

  void (async () => {
    const context = await getAudioContext();
    if (!context) return;
    if (context.state === 'suspended') await context.resume();
    renderAudioFeedback(context as unknown as AudioContextLike, kind);
  })().catch(error => console.warn('Could not play sound effect:', error));
}

export { dayRatingFeedback };
