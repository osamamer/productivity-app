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
    // Versioned filename prevents browsers and service workers from reusing
    // the old short rain clip that was previously published at /audio/rain.mp3.
    rain: '/audio/rain-5m.mp3',
    ocean: '/audio/ocean.mp3',
    forest: '/audio/forest.mp3',
    bowls: '/audio/bowls.mp3',
};

class MeditationSoundscape {
    private player: HTMLAudioElement | null = null;
    private previewTimeout: number | null = null;

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

    async preview(sound: MeditationSoundId): Promise<void> {
        this.stop();
        if (typeof window === 'undefined') return;
        const player = new Audio(SOUND_URLS[sound]);
        player.volume = 0.38;
        this.player = player;
        try {
            await player.play();
            if (this.player !== player) return;
            this.previewTimeout = window.setTimeout(() => {
                if (this.player === player) this.stop();
            }, 5_000);
        } catch (error) {
            if (this.player === player) this.stop();
            console.error('Could not preview meditation soundscape:', error);
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
        if (this.previewTimeout !== null && typeof window !== 'undefined') {
            window.clearTimeout(this.previewTimeout);
        }
        this.previewTimeout = null;
        this.player?.pause();
        this.player = null;
    }
}

export const meditationSoundscape = new MeditationSoundscape();
