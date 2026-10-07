import type { AudioMode } from 'expo-audio';

type AudioModuleLike = {
  setAudioModeAsync?: (mode: Partial<AudioMode>) => Promise<void>;
};

export async function configureBackgroundAudio(
  audioModule: AudioModuleLike,
  featureName: string,
  interruptionMode: AudioMode['interruptionMode'] = 'mixWithOthers',
): Promise<void> {
  if (typeof audioModule.setAudioModeAsync !== 'function') {
    console.warn(`${featureName} audio mode is unavailable in this native build.`);
    return;
  }

  try {
    await audioModule.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode,
    });
  } catch (error) {
    console.error(`Could not configure ${featureName} audio:`, error);
  }
}
