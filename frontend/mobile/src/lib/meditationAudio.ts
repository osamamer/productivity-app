import { MEDITATION_SOUND_OPTIONS, type MeditationSoundId, type MeditationSoundOption } from './meditationSoundOptions';

export { MEDITATION_SOUND_OPTIONS, type MeditationSoundId, type MeditationSoundOption };

export const MEDITATION_AUDIO_SOURCES: Record<MeditationSoundId, number> = {
  // The versioned filename prevents Metro/native asset caches from retaining
  // the old short rain clip bundled at the previous path.
  rain: require('../../assets/audio/rain-5m.mp3'),
  ocean: require('../../assets/audio/ocean.mp3'),
  forest: require('../../assets/audio/forest.mp3'),
  bowls: require('../../assets/audio/bowls.mp3'),
};

export const INTERVAL_BELL_SOURCE = MEDITATION_AUDIO_SOURCES.bowls;
