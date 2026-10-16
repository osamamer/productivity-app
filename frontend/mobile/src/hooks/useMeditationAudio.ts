import { createElement, useCallback, useEffect, useRef, useState } from 'react';

import { renderMeditationIntervalBell, type AudioContextLike } from '../../../shared/audioFeedback';
import { remainingIntervalBellOffsets } from '@/lib/meditationCueTimes';
import { MEDITATION_AUDIO_SOURCES, MEDITATION_COMPLETION_SOURCE, type MeditationSoundId } from '@/lib/meditationAudio';

type AudioModule = typeof import('react-native-audio-api');
type AudioContext = InstanceType<AudioModule['AudioContext']>;
type AudioTagHandle = import('react-native-audio-api').AudioTagHandle;
type AudioBuffer = InstanceType<AudioModule['AudioBuffer']>;
type GainNode = InstanceType<AudioModule['GainNode']>;
type MediaNode = InstanceType<AudioModule['MediaElementAudioSourceNode']>;

interface Runtime {
  module: AudioModule;
  context: AudioContext;
  ambientGain: GainNode;
  bellBuffer: AudioBuffer;
}

interface SessionRequest {
  remainingSeconds: number;
  intendedSeconds: number;
  intervalBells: number;
  requestedAt: number;
  running: boolean;
}

interface Timeline {
  endAt: number;
  intervalGain: GainNode;
  completionGain: GainNode;
}

const BACKGROUND_METADATA = { title: 'Meditation', artist: 'Claritard' };

function NativeAudioPlayer({ runtime, sound, onLoad, setHandle }: {
  runtime: Runtime;
  sound: MeditationSoundId;
  onLoad: () => void;
  setHandle: (handle: AudioTagHandle | null) => void;
}) {
  return createElement(runtime.module.Audio, {
    ref: setHandle,
    source: MEDITATION_AUDIO_SOURCES[sound],
    context: runtime.context,
    loop: true,
    preload: 'auto',
    onLoad,
    onError: (error: Error) => console.error('Could not load meditation soundscape:', error),
  });
}

export function useMeditationAudio() {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [renderedSound, setRenderedSound] = useState<MeditationSoundId>('rain');
  const runtimeRef = useRef<Runtime | null>(null);
  const audioRef = useRef<AudioTagHandle | null>(null);
  const mediaNode = useRef<MediaNode | null>(null);
  const loadedSound = useRef<MeditationSoundId | null>(null);
  const sessionRequest = useRef<SessionRequest | null>(null);
  const timeline = useRef<Timeline | null>(null);
  const mutedRef = useRef(false);
  const previewRequested = useRef(false);
  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operationVersion = useRef(0);
  const activationInFlight = useRef(false);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    void import('react-native-audio-api').then(async module => {
      module.AudioManager.setAudioSessionOptions({ iosCategory: 'playback' });
      const context = new module.AudioContext();
      const ambientGain = context.createGain();
      ambientGain.gain.value = 0;
      ambientGain.connect(context.destination);
      const bellBuffer = await context.decodeAudioData(MEDITATION_COMPLETION_SOURCE);
      if (disposed) {
        void context.close();
        return;
      }
      const nextRuntime = { module, context, ambientGain, bellBuffer };
      runtimeRef.current = nextRuntime;
      setRuntime(nextRuntime);
    }).catch(error => console.error('Could not initialize meditation audio:', error));

    return () => {
      disposed = true;
      operationVersion.current += 1;
      if (previewTimeout.current) clearTimeout(previewTimeout.current);
      mediaNode.current?.disconnect();
      timeline.current?.intervalGain.disconnect();
      timeline.current?.completionGain.disconnect();
      void runtimeRef.current?.context.close().catch(error => console.error('Could not close meditation audio:', error));
      void runtimeRef.current?.module.PlaybackNotificationManager.hide().catch(error => console.error('Could not hide meditation playback:', error));
      runtimeRef.current = null;
    };
  }, []);

  const activate = useCallback(async () => {
    const current = runtimeRef.current;
    const request = sessionRequest.current;
    if (!current || !request || timeline.current || activationInFlight.current || !audioRef.current || !loadedSound.current) return;

    activationInFlight.current = true;
    const version = operationVersion.current;
    try {
      const startupDelay = request.running ? (Date.now() - request.requestedAt) / 1_000 : 0;
      const remaining = Math.max(0, request.remainingSeconds - startupDelay);
      const elapsed = Math.max(0, request.intendedSeconds - remaining);
      const { context, module, ambientGain, bellBuffer } = current;
      if (request.running) await context.resume();
      else await context.suspend();
      if (version !== operationVersion.current) return;

      const startAt = context.currentTime + 0.05;
      const endAt = startAt + remaining;
      const intervalGain = context.createGain();
      intervalGain.gain.value = mutedRef.current ? 0 : 1;
      intervalGain.connect(context.destination);
      const completionGain = context.createGain();
      completionGain.connect(context.destination);

      ambientGain.gain.cancelScheduledValues(context.currentTime);
      ambientGain.gain.setValueAtTime(0, context.currentTime);
      ambientGain.gain.setValueAtTime(mutedRef.current ? 0 : 0.16, startAt);
      ambientGain.gain.setValueAtTime(0, endAt);

      for (const offset of remainingIntervalBellOffsets(request.intendedSeconds, elapsed, request.intervalBells)) {
        renderMeditationIntervalBell(
          context as unknown as AudioContextLike,
          startAt + offset,
          intervalGain as unknown as AudioContextLike['destination'],
        );
      }

      const completion = context.createBufferSource();
      completion.buffer = bellBuffer;
      completion.connect(completionGain);
      completion.onEnded = () => {
        if (version === operationVersion.current) stopRef.current();
      };
      completion.start(endAt);
      timeline.current = { endAt, intervalGain, completionGain };
      if (request.running) audioRef.current?.play();
      await module.PlaybackNotificationManager.show({
        ...BACKGROUND_METADATA,
        duration: request.intendedSeconds,
        elapsedTime: elapsed,
        state: request.running ? 'playing' : 'paused',
      });
      await Promise.all([
        module.PlaybackNotificationManager.enableControl('play', false),
        module.PlaybackNotificationManager.enableControl('pause', false),
        module.PlaybackNotificationManager.enableControl('stop', false),
        module.PlaybackNotificationManager.enableControl('nextTrack', false),
        module.PlaybackNotificationManager.enableControl('previousTrack', false),
        module.PlaybackNotificationManager.enableControl('skipForward', false),
        module.PlaybackNotificationManager.enableControl('skipBackward', false),
        module.PlaybackNotificationManager.enableControl('seekTo', false),
      ]);
    } catch (error) {
      console.error('Could not start meditation background playback:', error);
    } finally {
      activationInFlight.current = false;
    }
  }, []);

  const onAudioLoaded = useCallback(() => {
    const current = runtimeRef.current;
    const tag = audioRef.current;
    if (!current || !tag) return;
    try {
      mediaNode.current?.disconnect();
      mediaNode.current = current.context.createMediaElementSource(tag);
      mediaNode.current.connect(current.ambientGain);
      loadedSound.current = renderedSound;
      if (sessionRequest.current && !timeline.current) {
        void activate();
      } else if (sessionRequest.current?.running && timeline.current) {
        tag.play();
      } else if (previewRequested.current) {
        current.ambientGain.gain.value = 0.16;
        void current.context.resume().then(() => tag.play()).catch(error => console.error('Could not preview meditation sound:', error));
      }
    } catch (error) {
      console.error('Could not connect meditation soundscape:', error);
    }
  }, [activate, renderedSound]);

  const start = useCallback((sound: MeditationSoundId, remainingSeconds: number, intendedSeconds: number, intervalBells: number, running = true) => {
    operationVersion.current += 1;
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewRequested.current = false;
    sessionRequest.current = { remainingSeconds, intendedSeconds, intervalBells, requestedAt: Date.now(), running };
    setRenderedSound(sound);
    if (loadedSound.current === sound) void activate();
  }, [activate]);

  const changeSound = useCallback((sound: MeditationSoundId) => {
    if (loadedSound.current === sound) return;
    loadedSound.current = null;
    audioRef.current?.pause();
    setRenderedSound(sound);
  }, []);

  const previewSound = useCallback((sound: MeditationSoundId) => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewRequested.current = true;
    if (loadedSound.current === sound) {
      const current = runtimeRef.current;
      if (current) {
        current.ambientGain.gain.value = 0.16;
        void current.context.resume().then(() => audioRef.current?.play()).catch(error => console.error('Could not preview meditation sound:', error));
      }
    } else {
      changeSound(sound);
    }
    previewTimeout.current = setTimeout(() => {
      previewRequested.current = false;
      audioRef.current?.pause();
      const current = runtimeRef.current;
      if (current && !sessionRequest.current) {
        current.ambientGain.gain.value = 0;
        void current.context.suspend().catch(error => console.error('Could not pause meditation preview:', error));
      }
      previewTimeout.current = null;
    }, 5_000);
  }, [changeSound]);

  const pause = useCallback(() => {
    if (sessionRequest.current) {
      if (sessionRequest.current.running && !timeline.current) {
        sessionRequest.current.remainingSeconds = Math.max(0,
          sessionRequest.current.remainingSeconds - (Date.now() - sessionRequest.current.requestedAt) / 1_000);
        sessionRequest.current.requestedAt = Date.now();
      }
      sessionRequest.current.running = false;
    }
    audioRef.current?.pause();
    const current = runtimeRef.current;
    if (!current) return;
    void current.context.suspend().catch(error => console.error('Could not pause meditation audio:', error));
    void current.module.PlaybackNotificationManager.show({ ...BACKGROUND_METADATA, state: 'paused' })
      .catch(error => console.error('Could not update meditation playback:', error));
  }, []);

  const resume = useCallback(() => {
    if (sessionRequest.current) {
      sessionRequest.current.running = true;
      if (!timeline.current) sessionRequest.current.requestedAt = Date.now();
    }
    const current = runtimeRef.current;
    if (!current) return;
    void current.context.resume().then(() => {
      if (timeline.current) audioRef.current?.play();
      else void activate();
    }).catch(error => console.error('Could not resume meditation audio:', error));
    void current.module.PlaybackNotificationManager.show({ ...BACKGROUND_METADATA, state: 'playing' })
      .catch(error => console.error('Could not update meditation playback:', error));
  }, [activate]);

  const stop = useCallback(() => {
    operationVersion.current += 1;
    sessionRequest.current = null;
    previewRequested.current = false;
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewTimeout.current = null;
    audioRef.current?.pause();
    const current = runtimeRef.current;
    if (!current) return;
    const currentTimeline = timeline.current;
    timeline.current = null;
    currentTimeline?.intervalGain.disconnect();
    currentTimeline?.completionGain.disconnect();
    current.ambientGain.gain.cancelScheduledValues(current.context.currentTime);
    current.ambientGain.gain.value = 0;
    void current.context.suspend().catch(error => console.error('Could not stop meditation audio:', error));
    void current.module.PlaybackNotificationManager.hide().catch(error => console.error('Could not hide meditation playback:', error));
  }, []);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    const current = runtimeRef.current;
    if (!current) return;
    if (timeline.current && current.context.currentTime < timeline.current.endAt) {
      current.ambientGain.gain.setValueAtTime(muted ? 0 : 0.16, current.context.currentTime);
      timeline.current.intervalGain.gain.value = muted ? 0 : 1;
    }
  }, []);

  const setAudioHandle = useCallback((handle: AudioTagHandle | null) => {
    audioRef.current = handle;
  }, []);

  // React Compiler treats these native callbacks as ref reads; they run after render.
  // eslint-disable-next-line react-hooks/refs
  const playerElement = runtime ? createElement(NativeAudioPlayer, {
    key: renderedSound,
    runtime,
    sound: renderedSound,
    onLoad: onAudioLoaded,
    setHandle: setAudioHandle,
  }) : null;

  return { start, changeSound, previewSound, pause, resume, stop, setMuted, playerElement };
}
