import AsyncStorage from '@react-native-async-storage/async-storage';

import { MEDITATION_SOUND_OPTIONS, type MeditationSoundId } from '@/lib/meditationSoundOptions';
import { loadPage } from '@/lib/pageCache';

export interface MeditationSettings {
  durationMinutes: number;
  numIntervalBells: number;
  selectedSound: MeditationSoundId;
}

export const DEFAULT_MEDITATION_SETTINGS: MeditationSettings = {
  durationMinutes: 10, numIntervalBells: 2, selectedSound: 'rain',
};

export function meditationSettingsStorageKey(userId: string | undefined): string {
  return `solife.${userId ?? 'signed-out'}.meditation.settings`;
}

function isMeditationSound(value: unknown): value is MeditationSoundId {
  return typeof value === 'string' && MEDITATION_SOUND_OPTIONS.some(option => option.id === value);
}

export function loadMeditationSettings(key: string): Promise<MeditationSettings> {
  return loadPage(key, async () => {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) {
      const legacySound = await AsyncStorage.getItem('mobile.meditation.sound');
      return { ...DEFAULT_MEDITATION_SETTINGS, selectedSound: isMeditationSound(legacySound) ? legacySound : 'rain' };
    }
    try {
      const parsed = JSON.parse(stored) as Partial<MeditationSettings>;
      return {
        durationMinutes: typeof parsed.durationMinutes === 'number' && parsed.durationMinutes >= 1 && parsed.durationMinutes <= 60
          ? Math.floor(parsed.durationMinutes) : DEFAULT_MEDITATION_SETTINGS.durationMinutes,
        numIntervalBells: typeof parsed.numIntervalBells === 'number' && Number.isInteger(parsed.numIntervalBells) && parsed.numIntervalBells >= 0 && parsed.numIntervalBells <= 10
          ? parsed.numIntervalBells : DEFAULT_MEDITATION_SETTINGS.numIntervalBells,
        selectedSound: isMeditationSound(parsed.selectedSound) ? parsed.selectedSound : DEFAULT_MEDITATION_SETTINGS.selectedSound,
      };
    } catch (cause) {
      console.warn('Could not parse mobile meditation preferences:', cause);
      return DEFAULT_MEDITATION_SETTINGS;
    }
  });
}
