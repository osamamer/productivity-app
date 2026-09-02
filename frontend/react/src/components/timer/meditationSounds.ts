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

const SOUND_URLS: Record<MeditationSoundId, string> = {
    rain: '/audio/rain.mp3',
    ocean: '/audio/ocean.mp3',
    forest: '/audio/forest.mp3',
    bowls: '/audio/bowls.mp3',
};

class MeditationSoundscape {
    private player: HTMLAudioElement | null = null;

    async start(sound: MeditationSoundId): Promise<void> {
        this.stop();
        if (typeof window === 'undefined') return;
        const player = new Audio(SOUND_URLS[sound]);
        player.loop = true;
        player.volume = 0.38;
        this.player = player;
        try {
            await player.play();
        } catch (error) {
            if (this.player === player) this.stop();
            console.error('Could not play meditation soundscape:', error);
        }
    }

    pause(): void {
        this.player?.pause();
    }

    async resume(): Promise<void> {
        if (!this.player) return;
        try {
            await this.player.play();
        } catch (error) {
            console.error('Could not resume meditation soundscape:', error);
        }
    }

    stop(): void {
        stopIntervalBell();
        this.player?.pause();
        this.player = null;
    }
}

export const meditationSoundscape = new MeditationSoundscape();

let intervalBell: HTMLAudioElement | null = null;
let intervalBellTimeout: number | null = null;

export function playIntervalBell(): void {
    if (typeof window === 'undefined') return;
    intervalBell ??= new Audio(SOUND_URLS.bowls);
    intervalBell.volume = 0.42;
    intervalBell.currentTime = 0;
    void intervalBell.play().catch(error => console.error('Could not play meditation interval bell:', error));
    if (intervalBellTimeout !== null) window.clearTimeout(intervalBellTimeout);
    intervalBellTimeout = window.setTimeout(() => intervalBell?.pause(), 2200);
}

export function stopIntervalBell(): void {
    if (intervalBellTimeout !== null) window.clearTimeout(intervalBellTimeout);
    intervalBellTimeout = null;
    intervalBell?.pause();
}
