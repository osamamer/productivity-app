import { describe, expect, it } from 'vitest';
import {
    edgePath, monthTicks, PAST_WIDTH, roadGeometry, roadPhase, SOMEDAY_Y, timeScale, TODAY_Y, WEEK_PX, weekRow, yOfDate,
} from './roadLayout';

// The current week began on Sunday 2026-11-22; the today line closes it on Sunday 2026-11-29.
const scale = timeScale('2026-11-22', 52);
const at = (date: string) => new Date(`${date}T12:00:00`);

describe('the time scale', () => {
    it('puts the end of the current week on the today line and runs the past downwards', () => {
        expect(yOfDate(scale, at('2026-11-29'))).toBe(TODAY_Y);
        expect(yOfDate(scale, at('2026-11-22'))).toBe(TODAY_Y + WEEK_PX);
        expect(yOfDate(scale, at('2026-12-06'))).toBe(TODAY_Y - WEEK_PX);
    });

    it('gives each past week a row counted back from this week', () => {
        expect(weekRow(0)).toEqual({ top: TODAY_Y, bottom: TODAY_Y + WEEK_PX });
        expect(weekRow(2).top).toBe(TODAY_Y + 2 * WEEK_PX);
    });

    it('is tall enough for every past week', () => {
        expect(scale.height).toBeGreaterThan(weekRow(51).bottom);
    });
});

describe('road geometry', () => {
    it('keeps one width in the past and narrows into the future', () => {
        const road = roadGeometry(1, true);
        expect(road.width(TODAY_Y + 300)).toBe(PAST_WIDTH);
        expect(road.width(TODAY_Y - 400)).toBeLessThan(PAST_WIDTH);
        expect(road.width(SOMEDAY_Y / 2)).toBeLessThan(road.width(SOMEDAY_Y + 10));
    });

    it('is one continuous curve through today', () => {
        const road = roadGeometry(2.3, true);
        expect(Math.abs(road.center(TODAY_Y - 1) - road.center(TODAY_Y + 1))).toBeLessThan(0.5);
    });

    it('runs straight down the middle when straight', () => {
        const road = roadGeometry(2.3, false);
        expect(road.center(100)).toBe(road.center(TODAY_Y + 200));
    });

    it('gives each path a stable phase of its own', () => {
        expect(roadPhase('writer')).toBe(roadPhase('writer'));
        expect(roadPhase('writer')).not.toBe(roadPhase('body'));
        expect(roadPhase('writer')).toBeGreaterThanOrEqual(0);
        expect(roadPhase('writer')).toBeLessThan(2 * Math.PI);
    });

    it('draws edges as SVG paths that end where asked', () => {
        const path = edgePath(roadGeometry(0, false), 1, 0, 10);
        expect(path.startsWith('M')).toBe(true);
        expect(path.endsWith(' 10.0')).toBe(true);
    });
});

describe('month ticks', () => {
    const ticks = monthTicks(scale);

    it('labels months and names the year at January', () => {
        expect(ticks.some(tick => tick.label === 'Nov')).toBe(true);
        expect(ticks.filter(tick => tick.yearStart).map(tick => tick.label)).toEqual(['2026', '2027', '2028']);
    });

    it('stays between Someday and the bottom', () => {
        ticks.forEach(tick => {
            expect(tick.y).toBeGreaterThanOrEqual(SOMEDAY_Y);
            expect(tick.y).toBeLessThanOrEqual(scale.height);
        });
    });

    it('moves a month name off the Today pill but keeps its tick', () => {
        // December 1 is two days after the today line.
        const december = ticks.find(tick => tick.label === 'Dec' && Math.abs(tick.y - TODAY_Y) < 22);
        expect(december).toBeDefined();
        expect(december?.labelY).toBe(TODAY_Y - 24);
        expect(december?.y).not.toBe(december?.labelY);
    });
});
