import confetti from 'canvas-confetti';

function getOrigin(anchor: HTMLElement | null | undefined): { x?: number; y?: number } {
    if (!anchor) return { y: 0.72 };

    const rect = anchor.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return { y: 0.72 };

    return {
        x: Math.max(0, Math.min(1, (rect.left + rect.width / 2) / window.innerWidth)),
        y: Math.max(0, Math.min(1, (rect.top + rect.height / 2) / window.innerHeight)),
    };
}

export function celebrateStatLogged(anchor?: HTMLElement | null): void {
    confetti({
        particleCount: 72,
        spread: 58,
        startVelocity: 30,
        scalar: 0.9,
        origin: getOrigin(anchor),
        colors: ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0'],
        disableForReducedMotion: true,
    });
}
