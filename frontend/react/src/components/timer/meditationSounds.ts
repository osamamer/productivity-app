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

const NOISE_BUFFER_SECONDS = 2;

class MeditationSoundscape {
    private context: AudioContext | null = null;
    private output: GainNode | null = null;
    private sources: AudioScheduledSourceNode[] = [];
    private timers: number[] = [];

    async start(sound: MeditationSoundId): Promise<void> {
        this.stop();
        if (typeof window === 'undefined' || !window.AudioContext) return;

        const context = new window.AudioContext();
        const output = context.createGain();
        output.gain.setValueAtTime(0.7, context.currentTime);
        output.connect(context.destination);
        this.context = context;
        this.output = output;

        try {
            await context.resume();
        } catch {
            this.stop();
            return;
        }
        if (this.context !== context || context.state === 'closed') return;
        if (sound === 'rain') this.createRain(context, output);
        if (sound === 'ocean') this.createOcean(context, output);
        if (sound === 'forest') this.createForest(context, output);
        if (sound === 'bowls') this.createBowls(context, output);
    }

    pause(): void {
        if (this.context?.state === 'running') void this.context.suspend();
    }

    async resume(): Promise<void> {
        if (this.context?.state === 'suspended') await this.context.resume();
    }

    stop(): void {
        this.timers.forEach(timer => window.clearInterval(timer));
        this.timers = [];
        this.sources.forEach(source => {
            try {
                source.stop();
            } catch {
                // A source may already have reached its scheduled end.
            }
        });
        this.sources = [];
        if (this.context) void this.context.close();
        this.context = null;
        this.output = null;
    }

    private createRain(context: AudioContext, output: GainNode): void {
        const source = this.createNoise(context);
        const highpass = context.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 450;
        const lowpass = context.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 5200;
        const gain = context.createGain();
        gain.gain.value = 0.16;

        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(gain);
        gain.connect(output);
        source.start();
    }

    private createOcean(context: AudioContext, output: GainNode): void {
        const source = this.createNoise(context);
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        const gain = context.createGain();
        gain.gain.value = 0.05;
        const swell = context.createOscillator();
        const swellDepth = context.createGain();
        swell.frequency.value = 0.075;
        swellDepth.gain.value = 0.035;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        swell.connect(swellDepth);
        swellDepth.connect(gain.gain);
        source.start();
        swell.start();
        this.sources.push(swell);
    }

    private createForest(context: AudioContext, output: GainNode): void {
        const source = this.createNoise(context);
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1100;
        const gain = context.createGain();
        gain.gain.value = 0.035;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        source.start();

        const playBird = () => {
            if (this.context !== context || context.state === 'closed') return;
            const bird = context.createOscillator();
            const birdGain = context.createGain();
            const now = context.currentTime;
            const startFrequency = 1500 + Math.random() * 700;
            bird.type = 'sine';
            bird.frequency.setValueAtTime(startFrequency, now);
            bird.frequency.exponentialRampToValueAtTime(startFrequency * 1.4, now + 0.18);
            birdGain.gain.setValueAtTime(0.0001, now);
            birdGain.gain.exponentialRampToValueAtTime(0.035, now + 0.03);
            birdGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
            bird.connect(birdGain);
            birdGain.connect(output);
            bird.start(now);
            bird.stop(now + 0.3);
        };

        playBird();
        this.timers.push(window.setInterval(playBird, 9000));
    }

    private createBowls(context: AudioContext, output: GainNode): void {
        const playBowl = () => {
            if (this.context !== context || context.state === 'closed') return;
            const frequencies = [174.61, 220, 261.63];
            const frequency = frequencies[Math.floor(Math.random() * frequencies.length)];
            const now = context.currentTime;
            const gain = context.createGain();
            const fundamental = context.createOscillator();
            const overtone = context.createOscillator();

            fundamental.type = 'sine';
            fundamental.frequency.value = frequency;
            overtone.type = 'sine';
            overtone.frequency.value = frequency * 2.01;
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);
            fundamental.connect(gain);
            overtone.connect(gain);
            gain.connect(output);
            fundamental.start(now);
            overtone.start(now);
            fundamental.stop(now + 5.5);
            overtone.stop(now + 5.5);
        };

        playBowl();
        this.timers.push(window.setInterval(playBowl, 14000));
    }

    private createNoise(context: AudioContext): AudioBufferSourceNode {
        const length = context.sampleRate * NOISE_BUFFER_SECONDS;
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);
        let previous = 0;
        for (let index = 0; index < length; index += 1) {
            previous = previous * 0.98 + (Math.random() * 2 - 1) * 0.02;
            data[index] = previous * 3.5;
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        this.sources.push(source);
        return source;
    }
}

export const meditationSoundscape = new MeditationSoundscape();
