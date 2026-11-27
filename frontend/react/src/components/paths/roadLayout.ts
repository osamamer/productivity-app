import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Road geometry and the time scale for the Paths vortex, in SVG units of one column.
 * Time runs upwards: the future above the today line, the past below, one row of `WEEK_PX` per week.
 * The today line marks the end of the current week (next Sunday), so the current week's row sits
 * just under it and every week, past or future, keeps the same height.
 */
export const WEEK_PX = 20;
export const FUTURE_WEEKS = 78;
export const SOMEDAY_Y = 170;
export const BOTTOM_PAD = 40;
export const COLUMN_WIDTH = 220;
export const CENTER_X = COLUMN_WIDTH / 2;
export const TODAY_Y = SOMEDAY_Y + FUTURE_WEEKS * WEEK_PX;
export const PAST_WIDTH = 50;
const STEP = 4;

export interface TimeScale {
    /** The week the today line closes: the Sunday after the current week starts. */
    anchor: Date;
    pastWeeks: number;
    height: number;
}

export function timeScale(currentWeekStart: string, pastWeeks: number): TimeScale {
    return {
        anchor: addDays(parseISO(`${currentWeekStart}T12:00:00`), 7),
        pastWeeks,
        height: TODAY_Y + pastWeeks * WEEK_PX + BOTTOM_PAD,
    };
}

export function yOfDate(scale: TimeScale, date: Date): number {
    return TODAY_Y - (differenceInCalendarDays(date, scale.anchor) / 7) * WEEK_PX;
}

/** The row of a past week counted back from the current one (0 = this week). */
export function weekRow(weeksAgo: number): { top: number; bottom: number } {
    const top = TODAY_Y + weeksAgo * WEEK_PX;
    return { top, bottom: top + WEEK_PX };
}

export interface RoadGeometry {
    width: (y: number) => number;
    center: (y: number) => number;
}

/** A stable phase per path, so each curved road winds its own way. */
export function roadPhase(pathId: string): number {
    let hash = 0;
    for (let index = 0; index < pathId.length; index++) hash = (hash * 31 + pathId.charCodeAt(index)) | 0;
    return (Math.abs(hash) % 628) / 100;
}

/** The road narrows into the future and pinches out in the Someday zone; the past keeps one width. */
export function roadGeometry(phase: number, curved: boolean): RoadGeometry {
    const futureSpan = FUTURE_WEEKS * WEEK_PX;
    const width = (y: number) => {
        if (y >= TODAY_Y) return PAST_WIDTH;
        const t = Math.min(1, (TODAY_Y - y) / futureSpan);
        const w = 6 + (PAST_WIDTH - 6) * Math.pow(1 - t, 1.25);
        return y < SOMEDAY_Y ? Math.max(2, w * (y / SOMEDAY_Y)) : w;
    };
    // Measured from today, so past and future are one smooth curve with no kink at the today line.
    const center = (y: number) => {
        if (!curved) return CENTER_X;
        const t = (TODAY_Y - y) / futureSpan;
        const amplitude = 9 + 24 * Math.max(0, Math.min(t, 1.1));
        return CENTER_X + amplitude * (Math.sin(phase + t * 5) - Math.sin(phase));
    };
    return { width, center };
}

/** One wall (side -1 or 1) or the centre line (side 0) between two heights, as an SVG path. */
export function edgePath(geometry: RoadGeometry, side: -1 | 0 | 1, y0: number, y1: number): string {
    const points: string[] = [];
    for (let y = y0; y <= y1 + 0.01; y += STEP) points.push(point(geometry.center(y) + side * geometry.width(y) / 2, y));
    if ((y1 - y0) % STEP !== 0) points.push(point(geometry.center(y1) + side * geometry.width(y1) / 2, y1));
    return `M${points.join('L')}`;
}

function point(x: number, y: number): string {
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

export interface MonthTick {
    y: number;
    labelY: number;
    label: string;
    yearStart: boolean;
}

const TODAY_CLEARANCE = 22;

/**
 * Month starts on the left axis between Someday and the bottom. A label that would sit on the
 * Today pill keeps its tick but moves its name clear of it.
 */
export function monthTicks(scale: TimeScale): MonthTick[] {
    const ticks: MonthTick[] = [];
    const first = new Date(scale.anchor.getFullYear(), scale.anchor.getMonth() - Math.ceil(scale.pastWeeks / 4) - 1, 1, 12);
    for (let month = 0; ; month++) {
        const date = new Date(first.getFullYear(), first.getMonth() + month, 1, 12);
        const y = yOfDate(scale, date);
        if (y < SOMEDAY_Y) break;
        if (y > scale.height - BOTTOM_PAD) continue;
        const yearStart = date.getMonth() === 0;
        const nearToday = Math.abs(y - TODAY_Y) < TODAY_CLEARANCE;
        ticks.push({
            y,
            labelY: nearToday ? (y < TODAY_Y ? TODAY_Y - 24 : TODAY_Y + 26) : y,
            label: yearStart ? String(date.getFullYear()) : date.toLocaleDateString('en-US', { month: 'short' }),
            yearStart,
        });
    }
    return ticks;
}
