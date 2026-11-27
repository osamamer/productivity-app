import { describe, expect, it } from 'vitest';
import type { PathRoad } from '../../types/Path';
import { moveBefore, onPaceCount, recentStrength, sortRoads } from './pathsSummary';

function road(id: string, strengths: number[], { displayOrder = 0, paused = false } = {}): PathRoad {
    return {
        path: {
            id, name: id, color: '#A395F2', icon: 'mind', displayOrder, paused,
            signal: { combineMethod: 'AVERAGE', inputs: [] },
        },
        weeks: strengths.map((strength, index) => ({ weekStart: `2026-11-0${index + 1}`, elapsedDays: 7, strength, inputs: [] })),
    };
}

describe('recent strength', () => {
    it('averages the last four weeks with each capped at 1', () => {
        expect(recentStrength(road('a', [0, 1.25, 1, 0.5, 0.5]).weeks)).toBeCloseTo(0.75);
    });

    it('is zero with no weeks', () => {
        expect(recentStrength([])).toBe(0);
    });
});

describe('on pace', () => {
    it('counts active paths whose current week is at least 1', () => {
        const roads = [road('a', [0, 1]), road('b', [1, 0.6]), road('c', [1, 1.2], { paused: true })];
        expect(onPaceCount(roads)).toEqual({ onPace: 1, active: 2 });
    });
});

describe('sorting', () => {
    const roads = [road('steady', [1, 1, 1, 1], { displayOrder: 2 }), road('slipping', [0, 0, 0.5, 0], { displayOrder: 0 }),
        road('middling', [0.5, 0.5, 0.5, 0.5], { displayOrder: 1 })];
    const names = (sorted: PathRoad[]) => sorted.map(item => item.path.id);

    it('puts the weakest first when sorting by what needs attention', () => {
        expect(names(sortRoads(roads, 'ATTENTION'))).toEqual(['slipping', 'middling', 'steady']);
    });

    it('puts the strongest first', () => {
        expect(names(sortRoads(roads, 'STRONGEST'))).toEqual(['steady', 'middling', 'slipping']);
    });

    it('follows the chosen order in My order', () => {
        expect(names(sortRoads(roads, 'CUSTOM'))).toEqual(['slipping', 'middling', 'steady']);
    });
});

describe('dragging a column', () => {
    it('takes the place of the column it is dropped on', () => {
        expect(moveBefore(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
        expect(moveBefore(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
        expect(moveBefore(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
    });
});
