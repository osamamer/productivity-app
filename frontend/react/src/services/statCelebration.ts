import confetti from 'canvas-confetti';

type CelebrationAnchor = HTMLElement | DOMRect;

function getOrigin(anchor: CelebrationAnchor | null | undefined): { x?: number; y?: number } {
    if (!anchor) return { y: 0.72 };

    const rect = 'getBoundingClientRect' in anchor ? anchor.getBoundingClientRect() : anchor;
    if (rect.width === 0 && rect.height === 0) return { y: 0.72 };

    return {
        x: Math.max(0, Math.min(1, (rect.left + rect.width / 2) / window.innerWidth)),
        y: Math.max(0, Math.min(1, (rect.top + rect.height / 2) / window.innerHeight)),
    };
}

export function celebrateStatLogged(anchor?: CelebrationAnchor | null): void {
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

let sadAnimationStylesAdded = false;

function ensureSadAnimationStyles(): void {
    if (sadAnimationStylesAdded || document.getElementById('stat-sad-animation-styles')) return;

    const style = document.createElement('style');
    style.id = 'stat-sad-animation-styles';
    style.textContent = `
        @keyframes stat-sad-feedback {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(.7) rotate(-8deg); }
            18% { opacity: 1; transform: translate(-50%, -50%) scale(1.08) rotate(5deg); }
            100% { opacity: 0; transform: translate(-50%, 42px) scale(.95) rotate(-4deg); }
        }
    `;
    document.head.appendChild(style);
    sadAnimationStylesAdded = true;
}

export function reprimandStatLogged(anchor?: CelebrationAnchor | null): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    ensureSadAnimationStyles();
    const origin = getOrigin(anchor);
    const animation = document.createElement('div');
    animation.textContent = '😔';
    animation.setAttribute('aria-hidden', 'true');
    Object.assign(animation.style, {
        position: 'fixed',
        left: `${(origin.x ?? 0.5) * 100}%`,
        top: `${(origin.y ?? 0.72) * 100}%`,
        zIndex: '1500',
        pointerEvents: 'none',
        fontSize: '2rem',
        lineHeight: '1',
        filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, .25))',
        animation: 'stat-sad-feedback 900ms ease-out forwards',
    });
    document.body.appendChild(animation);
    window.setTimeout(() => animation.remove(), 950);
}
