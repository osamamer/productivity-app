import { useCallback, useEffect, useRef } from 'react';

import {
  MEDITATION_AUDIO_SOURCES,
  MEDITATION_COMPLETION_SOURCE,
  type MeditationSoundId,
} from '@/lib/meditationAudio';
import { playMeditationIntervalBell, prepareMeditationAudio } from '@/lib/audioFeedback';
import { configureBackgroundAudio } from '@/lib/audioMode';

type AudioModule = typeof import('expo-audio');
type AudioPlayer = ReturnType<AudioModule['createAudioPlayer']>;
type PendingSound = { sound: MeditationSoundId; loop: boolean };

const LOCK_SCREEN_METADATA = { title: 'Meditation', artist: 'Claritard' };

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
  const pendingSound = useRef<PendingSound | null>(null);
  const previewingSound = useRef<MeditationSoundId | null>(null);
  const mutedRef = useRef(false);
  const backgroundSessionActive = useRef(false);
  const completionPending = useRef(false);
  const completionPlaying = useRef(false);
  const completionStartedAt = useRef(0);
  const statusSubscription = useRef<{ remove: () => void } | null>(null);

  const activateLockScreenPlayback = useCallback((currentPlayer: AudioPlayer) => {
    // Android needs active media controls to keep its background audio service alive.
    currentPlayer.setActiveForLockScreen(true, LOCK_SCREEN_METADATA, {
      showSeekForward: false,
      showSeekBackward: false,
    });
  }, []);

  const playCompletionOnPlayer = useCallback((currentPlayer: AudioPlayer) => {
    completionPending.current = false;
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewTimeout.current = null;
    previewingSound.current = null;
    pendingSound.current = null;
    activateLockScreenPlayback(currentPlayer);
    currentPlayer.replace(MEDITATION_COMPLETION_SOURCE);
    currentPlayer.loop = false;
    currentPlayer.volume = 1;
    currentPlayer.muted = false;
    completionPlaying.current = true;
    completionStartedAt.current = Date.now();
    currentPlayer.play();
  }, [activateLockScreenPlayback]);

  const loadSound = useCallback((sound: MeditationSoundId, loop: boolean) => {
    const currentPlayer = player.current;
    if (!currentPlayer) {
      pendingSound.current = { sound, loop };
      return;
    }
    const continuePreview = loop && previewingSound.current === sound;
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewTimeout.current = null;
    previewingSound.current = loop ? null : sound;
    if (backgroundSessionActive.current) activateLockScreenPlayback(currentPlayer);
    if (!continuePreview) currentPlayer.replace(MEDITATION_AUDIO_SOURCES[sound]);
    currentPlayer.loop = loop;
    currentPlayer.volume = 0.16;
    currentPlayer.muted = mutedRef.current;
    currentPlayer.play();
    if (!loop) {
      previewTimeout.current = setTimeout(() => {
        if (player.current !== currentPlayer || previewingSound.current !== sound) return;
        currentPlayer.pause();
        previewingSound.current = null;
        previewTimeout.current = null;
      }, 5_000);
    }
  }, [activateLockScreenPlayback]);

  useEffect(() => {
    let disposed = false;

    void loadAudioModule().then(async audioModule => {
      if (!audioModule || disposed) return;

      await configureBackgroundAudio(audioModule, 'meditation', 'doNotMix');
      if (disposed) return;

      if (typeof audioModule.createAudioPlayer !== 'function') {
        console.warn('Meditation audio playback is unavailable in this native build.');
        return;
      }
      const nextPlayer = audioModule.createAudioPlayer(null, { keepAudioSessionActive: true, updateInterval: 1_000 });
      if (disposed) {
        nextPlayer.remove();
        return;
      }

      player.current = nextPlayer;
      statusSubscription.current = nextPlayer.addListener('playbackStatusUpdate', status => {
        if (!status.didJustFinish || !completionPlaying.current
          || Date.now() - completionStartedAt.current < 1_500) return;
        completionPlaying.current = false;
        backgroundSessionActive.current = false;
        nextPlayer.pause();
        nextPlayer.setActiveForLockScreen(false);
      });

      if (completionPending.current) {
        playCompletionOnPlayer(nextPlayer);
      } else {
        const pending = pendingSound.current;
        pendingSound.current = null;
        if (pending) loadSound(pending.sound, pending.loop);
      }
    });

    return () => {
      disposed = true;
      backgroundSessionActive.current = false;
      completionPending.current = false;
      completionPlaying.current = false;
      pendingSound.current = null;
      previewingSound.current = null;
      if (previewTimeout.current) clearTimeout(previewTimeout.current);
      statusSubscription.current?.remove();
      statusSubscription.current = null;
      player.current?.setActiveForLockScreen(false);
      player.current?.remove();
      player.current = null;
    };
  }, [loadSound, playCompletionOnPlayer]);

  const start = useCallback((sound: MeditationSoundId) => {
    backgroundSessionActive.current = true;
    loadSound(sound, true);
  }, [loadSound]);
  const changeSound = useCallback((sound: MeditationSoundId) => loadSound(sound, true), [loadSound]);
  const previewSound = useCallback((sound: MeditationSoundId) => loadSound(sound, false), [loadSound]);
  const pause = useCallback(() => {
    backgroundSessionActive.current = false;
    player.current?.pause();
    player.current?.setActiveForLockScreen(false);
  }, []);
  const resume = useCallback(() => {
    backgroundSessionActive.current = true;
    const currentPlayer = player.current;
    if (!currentPlayer) return;
    activateLockScreenPlayback(currentPlayer);
    currentPlayer.play();
  }, [activateLockScreenPlayback]);
  const stop = useCallback(() => {
    backgroundSessionActive.current = false;
    completionPending.current = false;
    completionPlaying.current = false;
    pendingSound.current = null;
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewTimeout.current = null;
    previewingSound.current = null;
    player.current?.pause();
    player.current?.setActiveForLockScreen(false);
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    if (player.current) player.current.muted = muted;
  }, []);
  const playBell = useCallback(() => playMeditationIntervalBell(), []);
  const playCompletionGong = useCallback(() => {
    completionPending.current = true;
    if (player.current) playCompletionOnPlayer(player.current);
  }, [playCompletionOnPlayer]);
  const prepareAudio = useCallback(() => prepareMeditationAudio(), []);

  return { start, changeSound, previewSound, pause, resume, stop, setMuted, playBell, playCompletionGong, prepareAudio };
}
