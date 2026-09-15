import type { AudioMode } from 'expo-audio';

type AudioModuleLike = {
  setAudioModeAsync?: (mode: Partial<AudioMode>) => Promise<void>;
};

export async function configureBackgroundAudio(
  audioModule: AudioModuleLike,
  featureName: string,
): Promise<void> {
  if (typeof audioModule.setAudioModeAsync !== 'function') {
    console.warn(`${featureName} audio mode is unavailable in this native build.`);
    return;
  }

  try {
    await audioModule.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    });
  } catch (error) {
    console.error(`Could not configure ${featureName} audio:`, error);
  }
}
