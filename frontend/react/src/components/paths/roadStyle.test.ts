import { describe, expect, it } from 'vitest';
import {
    centreDashOpacity, mixHex, REINFORCE_GOOD, reinforcementColor, WALL_GREY, wallStyle,
} from './roadStyle';

const WRITER = '#A395F2';

describe('walls', () => {
    it('are the path colour at full strength in a kept week, with a slight glow', () => {
        expect(wallStyle(1, WRITER, 'FOLLOW_WEEKS')).toEqual({ color: WRITER.toLowerCase(), opacity: 1, glow: 0.28 });
    });

    it('glow a little more in exceptional weeks', () => {
        expect(wallStyle(1.25, WRITER, 'FOLLOW_WEEKS').glow).toBeCloseTo(0.45);
    });

    it('turn greyer and fainter as strength drops, without glow', () => {
        const half = wallStyle(0.5, WRITER, 'FOLLOW_WEEKS');
        expect(half.opacity).toBeCloseTo(0.725);
        expect(half.glow).toBe(0);
        expect(half.color).not.toBe(WRITER.toLowerCase());
    });

    it('are a faint grey dash for a week with nothing', () => {
        expect(wallStyle(0, WRITER, 'FOLLOW_WEEKS')).toEqual({ color: WALL_GREY, opacity: 0.25, glow: 0 });
    });

    it('stay constant in the path colour when edges are constant', () => {
        expect(wallStyle(0, WRITER, 'CONSTANT')).toEqual(wallStyle(1.2, WRITER, 'CONSTANT'));
        expect(wallStyle(1.2, WRITER, 'CONSTANT').glow).toBe(0);
    });
});

describe('the centre line', () => {
    it('follows strength and stays faint for an empty week', () => {
        expect(centreDashOpacity(0)).toBe(0.08);
        expect(centreDashOpacity(1)).toBe(1);
        expect(centreDashOpacity(1.25)).toBe(1);
        expect(centreDashOpacity(0.5)).toBeCloseTo(0.59);
    });
});

describe('reinforcement colours', () => {
    it('are green on pace, nothing for an empty week, and warmer below', () => {
        expect(reinforcementColor(1)).toBe(REINFORCE_GOOD);
        expect(reinforcementColor(0)).toBeNull();
        expect(reinforcementColor(0.3)).not.toBe(reinforcementColor(0.8));
    });
});

describe('mixing colours', () => {
    it('blends two hex colours', () => {
        expect(mixHex('#ffffff', '#000000', 0.5)).toBe('#808080');
        expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#ff0000');
    });
});
