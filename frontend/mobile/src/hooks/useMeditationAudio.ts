import { useCallback, useEffect, useRef } from 'react';

import { INTERVAL_BELL_SOURCE, MEDITATION_AUDIO_SOURCES, type MeditationSoundId } from '@/lib/meditationAudio';

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
  const bellPlayer = useRef<AudioPlayer | null>(null);
  const bellTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const nextBellPlayer = audioModule.createAudioPlayer(INTERVAL_BELL_SOURCE, { keepAudioSessionActive: true });
      if (disposed) {
        nextPlayer.remove();
        nextBellPlayer.remove();
        return;
      }

      player.current = nextPlayer;
      nextBellPlayer.volume = 0.32;
      bellPlayer.current = nextBellPlayer;
    });

    return () => {
      disposed = true;
      if (bellTimeout.current) clearTimeout(bellTimeout.current);
      player.current?.remove();
      bellPlayer.current?.remove();
      player.current = null;
      bellPlayer.current = null;
    };
  }, []);

  const loadSound = useCallback((sound: MeditationSoundId, play: boolean) => {
    const currentPlayer = player.current;
    if (!currentPlayer) return;
    currentPlayer.replace(MEDITATION_AUDIO_SOURCES[sound]);
    currentPlayer.loop = true;
    currentPlayer.volume = 0.16;
    if (play) currentPlayer.play();
  }, []);

  const start = useCallback((sound: MeditationSoundId) => loadSound(sound, true), [loadSound]);
  const changeSound = useCallback((sound: MeditationSoundId) => loadSound(sound, true), [loadSound]);
  const pause = useCallback(() => player.current?.pause(), []);
  const resume = useCallback(() => player.current?.play(), []);
  const stop = useCallback(() => {
    player.current?.pause();
    if (bellTimeout.current) clearTimeout(bellTimeout.current);
    bellPlayer.current?.pause();
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    if (player.current) player.current.muted = muted;
  }, []);
  const playBell = useCallback(() => {
    const currentBellPlayer = bellPlayer.current;
    if (!currentBellPlayer) return;
    if (bellTimeout.current) clearTimeout(bellTimeout.current);
    void currentBellPlayer.seekTo(0).then(() => {
      currentBellPlayer.play();
      bellTimeout.current = setTimeout(() => currentBellPlayer.pause(), 2_200);
    }).catch(error => console.error('Could not play meditation interval bell:', error));
  }, []);

  return { start, changeSound, pause, resume, stop, setMuted, playBell };
}
