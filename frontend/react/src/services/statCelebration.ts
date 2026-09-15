import confetti from 'canvas-confetti';

export type CelebrationAnchor = HTMLElement | DOMRect;

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

let goodFeedbackStylesAdded = false;

function ensureGoodFeedbackStyles(): void {
    if (goodFeedbackStylesAdded || document.getElementById('stat-good-feedback-styles')) return;

    const style = document.createElement('style');
    style.id = 'stat-good-feedback-styles';
    style.textContent = `
        @keyframes stat-good-feedback {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(.65);
                box-shadow: 0 0 0 0 rgba(46, 125, 50, .42);
            }
            18% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.08);
                box-shadow: 0 0 0 0 rgba(46, 125, 50, .42);
            }
            70% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
                box-shadow: 0 0 0 9px rgba(46, 125, 50, 0);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(1.08);
                box-shadow: 0 0 0 15px rgba(46, 125, 50, 0);
            }
        }

        .stat-good-feedback {
            position: relative;
            box-sizing: border-box;
            width: 30px;
            height: 30px;
            border: 2px solid currentColor;
            border-radius: 50%;
            background: rgba(46, 125, 50, .12);
            color: #2e7d32;
        }

        .stat-good-feedback::before {
            content: '';
            position: absolute;
            top: 4px;
            left: 8px;
            width: 8px;
            height: 14px;
            border: solid currentColor;
            border-width: 0 3px 3px 0;
            border-radius: 1px;
            transform: rotate(45deg);
        }
    `;
    document.head.appendChild(style);
    goodFeedbackStylesAdded = true;
}

export function affirmStatLogged(anchor?: CelebrationAnchor | null): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    ensureGoodFeedbackStyles();
    const origin = getOrigin(anchor);
    const animation = document.createElement('div');
    animation.className = 'stat-good-feedback';
    animation.setAttribute('aria-hidden', 'true');
    Object.assign(animation.style, {
        position: 'fixed',
        left: `${(origin.x ?? 0.5) * 100}%`,
        top: `${(origin.y ?? 0.72) * 100}%`,
        zIndex: '1500',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, .25))',
        animation: 'stat-good-feedback 900ms cubic-bezier(.2, .8, .2, 1) forwards',
        willChange: 'transform, opacity, box-shadow',
    });
    document.body.appendChild(animation);
    window.setTimeout(() => animation.remove(), 950);
}

let badFeedbackStylesAdded = false;

function ensureBadFeedbackStyles(): void {
    if (badFeedbackStylesAdded || document.getElementById('stat-bad-feedback-styles')) return;

    const style = document.createElement('style');
    style.id = 'stat-bad-feedback-styles';
    style.textContent = `
        @keyframes stat-bad-feedback {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(.65);
                box-shadow: 0 0 0 0 rgba(211, 47, 47, .42);
            }
            18% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
                box-shadow: 0 0 0 0 rgba(211, 47, 47, .42);
            }
            70% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
                box-shadow: 0 0 0 9px rgba(211, 47, 47, 0);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(1.08);
                box-shadow: 0 0 0 15px rgba(211, 47, 47, 0);
            }
        }

        .stat-bad-feedback {
            position: relative;
            box-sizing: border-box;
            width: 30px;
            height: 30px;
            border: 2px solid currentColor;
            border-radius: 50%;
            background: rgba(211, 47, 47, .12);
            color: #d32f2f;
        }

        .stat-bad-feedback::before,
        .stat-bad-feedback::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 14px;
            height: 2px;
            border-radius: 999px;
            background: currentColor;
        }

        .stat-bad-feedback::before {
            transform: translate(-50%, -50%) rotate(45deg);
        }

        .stat-bad-feedback::after {
            transform: translate(-50%, -50%) rotate(-45deg);
        }
    `;
    document.head.appendChild(style);
    badFeedbackStylesAdded = true;
}

export function reprimandStatLogged(anchor?: CelebrationAnchor | null): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    ensureBadFeedbackStyles();
    const origin = getOrigin(anchor);
    const animation = document.createElement('div');
    animation.className = 'stat-bad-feedback';
    animation.setAttribute('aria-hidden', 'true');
    Object.assign(animation.style, {
        position: 'fixed',
        left: `${(origin.x ?? 0.5) * 100}%`,
        top: `${(origin.y ?? 0.72) * 100}%`,
        zIndex: '1500',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, .25))',
        animation: 'stat-bad-feedback 900ms cubic-bezier(.2, .8, .2, 1) forwards',
        willChange: 'transform, opacity, box-shadow',
    });
    document.body.appendChild(animation);
    window.setTimeout(() => animation.remove(), 950);
}
