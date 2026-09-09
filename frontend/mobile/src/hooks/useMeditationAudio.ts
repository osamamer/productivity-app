import { useCallback, useEffect, useRef } from 'react';

import { MEDITATION_AUDIO_SOURCES, type MeditationSoundId } from '@/lib/meditationAudio';
import { playMeditationCompletionGong, playMeditationIntervalBell, prepareMeditationAudio } from '@/lib/audioFeedback';

type AudioModule = typeof import('expo-audio');
type AudioPlayer = ReturnType<AudioModule['createAudioPlayer']>;

async function loadAudioModule(): Promise<AudioModule | null> {
  try {
    return await import('expo-audio');
  } catch (error) {
    // Expo Go and development builds created before expo-audio was installed do
    // not include the native module. Meditation remains usable without sound.
    console.warn('Meditation audio is unavailable in this native build.', error);
    return null;
  }
}

export function useMeditationAudio() {
  const player = useRef<AudioPlayer | null>(null);
  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;

    void loadAudioModule().then(audioModule => {
      if (!audioModule || disposed) return;

      void audioModule.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'mixWithOthers',
      }).catch(error => console.error('Could not configure meditation audio:', error));

      const nextPlayer = audioModule.createAudioPlayer(null, { keepAudioSessionActive: true, updateInterval: 1_000 });
      if (disposed) {
        nextPlayer.remove();
        return;
      }

      player.current = nextPlayer;
    });

    return () => {
      disposed = true;
      if (previewTimeout.current) clearTimeout(previewTimeout.current);
      player.current?.remove();
      player.current = null;
    };
  }, []);

  const loadSound = useCallback((sound: MeditationSoundId, play: boolean) => {
    const currentPlayer = player.current;
    if (!currentPlayer) return;
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewTimeout.current = null;
    currentPlayer.replace(MEDITATION_AUDIO_SOURCES[sound]);
    currentPlayer.loop = true;
    currentPlayer.volume = 0.16;
    if (play) currentPlayer.play();
  }, []);

  const start = useCallback((sound: MeditationSoundId) => loadSound(sound, true), [loadSound]);
  const changeSound = useCallback((sound: MeditationSoundId) => loadSound(sound, true), [loadSound]);
  const previewSound = useCallback((sound: MeditationSoundId) => {
    const currentPlayer = player.current;
    if (!currentPlayer) return;
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    currentPlayer.replace(MEDITATION_AUDIO_SOURCES[sound]);
    currentPlayer.loop = false;
    currentPlayer.volume = 0.16;
    currentPlayer.play();
    previewTimeout.current = setTimeout(() => {
      if (player.current === currentPlayer) currentPlayer.pause();
      previewTimeout.current = null;
    }, 5_000);
  }, []);
  const pause = useCallback(() => player.current?.pause(), []);
  const resume = useCallback(() => player.current?.play(), []);
  const stop = useCallback(() => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewTimeout.current = null;
    player.current?.pause();
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    if (player.current) player.current.muted = muted;
  }, []);
  const playBell = useCallback(() => playMeditationIntervalBell(), []);
  const playCompletionGong = useCallback(() => playMeditationCompletionGong(), []);
  const prepareAudio = useCallback(() => prepareMeditationAudio(), []);

  return { start, changeSound, previewSound, pause, resume, stop, setMuted, playBell, playCompletionGong, prepareAudio };
}
