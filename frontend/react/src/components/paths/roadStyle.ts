import type { PathEdges } from '../../types/Path';

/** How a week's strength is drawn. Colour carries the signal; glow is kept for kept weeks only. */
export const WALL_GREY = '#6E6E7A';
export const FUTURE_GREY = '#8C8C99';
export const REINFORCE_GOOD = '#22C55E';
export const REINFORCE_MID = '#FAEC66';
export const REINFORCE_LOW = '#F97316';
const CAP = 1.25;

function rgb(hex: string): number[] {
    return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
}

/** `amount` of `a` mixed into `b`. */
export function mixHex(a: string, b: string, amount: number): string {
    const left = rgb(a);
    const right = rgb(b);
    return `#${left.map((value, index) => Math.round(value * amount + right[index] * (1 - amount))
        .toString(16).padStart(2, '0')).join('')}`;
}

export interface WallStyle {
    color: string;
    opacity: number;
    glow: number;
}

export function wallStyle(strength: number, pathColor: string, edges: PathEdges): WallStyle {
    if (edges === 'CONSTANT') return { color: pathColor, opacity: 0.7, glow: 0 };
    if (strength <= 0) return { color: WALL_GREY, opacity: 0.25, glow: 0 };
    const kept = Math.min(strength, 1);
    const exceptional = Math.max(0, Math.min(strength, CAP) - 1) / (CAP - 1);
    return {
        color: mixHex(pathColor, WALL_GREY, 0.35 + 0.65 * kept),
        opacity: 0.45 + 0.55 * kept,
        glow: strength >= 1 ? 0.28 + 0.17 * exceptional : 0,
    };
}

export function centreDashOpacity(strength: number): number {
    return strength <= 0 ? 0.08 : 0.18 + 0.82 * Math.min(strength, 1);
}

/** Green when on pace, through yellow, to orange. Only for header dots and chips, never the roads. */
export function reinforcementColor(strength: number): string | null {
    if (strength <= 0) return null;
    if (strength >= 1) return REINFORCE_GOOD;
    return strength >= 0.5
        ? mixHex(REINFORCE_GOOD, REINFORCE_MID, (strength - 0.5) * 2)
        : mixHex(REINFORCE_MID, REINFORCE_LOW, strength * 2);
}

/** The future road: grey with a hint of the path's colour. */
export function futureColor(pathColor: string): string {
    return mixHex(pathColor, FUTURE_GREY, 0.22);
}
