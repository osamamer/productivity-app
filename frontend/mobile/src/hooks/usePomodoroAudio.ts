import { useCallback, useEffect, useRef, useState } from 'react';

import { POMODORO_AUDIO_SOURCE } from '@/lib/pomodoroAudio';
import { configureBackgroundAudio } from '@/lib/audioMode';

type AudioModule = typeof import('expo-audio');
type AudioPlayer = ReturnType<AudioModule['createAudioPlayer']>;

async function loadAudioModule(): Promise<AudioModule | null> {
  try {
    return await import('expo-audio');
  } catch (error) {
    // Expo Go and development builds created before expo-audio was installed do
    // not include the native module. Pomodoro remains usable without ambience.
    console.warn('Pomodoro audio is unavailable in this native build.', error);
    return null;
  }
}

export function usePomodoroAudio() {
  const player = useRef<AudioPlayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;

    void loadAudioModule().then(audioModule => {
      if (!audioModule || disposed) return;

      void configureBackgroundAudio(audioModule, 'Pomodoro');

      if (typeof audioModule.createAudioPlayer !== 'function') {
        console.warn('Pomodoro audio playback is unavailable in this native build.');
        return;
      }
      const nextPlayer = audioModule.createAudioPlayer(POMODORO_AUDIO_SOURCE, { keepAudioSessionActive: true });
      nextPlayer.loop = true;
      nextPlayer.volume = 0.12;
      if (disposed) {
        nextPlayer.remove();
        return;
      }

      player.current = nextPlayer;
      setReady(true);
    });

    return () => {
      disposed = true;
      player.current?.remove();
      player.current = null;
    };
  }, []);

  const start = useCallback(() => player.current?.play(), []);
  const stop = useCallback(() => {
    const currentPlayer = player.current;
    if (!currentPlayer) return;
    currentPlayer.pause();
    void currentPlayer.seekTo(0).catch(error => console.warn('Could not reset Pomodoro audio:', error));
  }, []);

  return { ready, start, stop };
}
