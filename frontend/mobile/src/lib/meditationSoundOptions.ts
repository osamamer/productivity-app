export type MeditationSoundId = 'rain' | 'ocean' | 'forest' | 'bowls';

export interface MeditationSoundOption {
  id: MeditationSoundId;
  label: string;
  description: string;
}

export const MEDITATION_SOUND_OPTIONS: MeditationSoundOption[] = [
  { id: 'rain', label: 'Soft rain', description: 'A steady, gentle rainfall' },
  { id: 'ocean', label: 'Calm ocean', description: 'Slow waves on a quiet shore' },
  { id: 'forest', label: 'Forest breeze', description: 'Leaves and distant birdsong' },
  { id: 'bowls', label: 'Singing bowls', description: 'A resonant bowl every few moments' },
];
