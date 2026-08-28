import confetti from 'canvas-confetti';

export function celebrateStatLogged(): void {
    confetti({
        particleCount: 72,
        spread: 58,
        startVelocity: 30,
        scalar: 0.9,
        origin: { y: 0.72 },
        colors: ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0'],
        disableForReducedMotion: true,
    });
}
