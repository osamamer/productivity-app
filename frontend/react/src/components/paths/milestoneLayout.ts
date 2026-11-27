import { parseISO } from 'date-fns';
import type { Checkpoint, Milestone } from '../../types/Path';
import { BOTTOM_PAD, SOMEDAY_Y, type TimeScale, TODAY_Y, yOfDate } from './roadLayout';

export type MilestoneKind = 'active' | 'future' | 'someday' | 'done';

export interface MilestoneMark {
    milestone: Milestone;
    y: number;
    kind: MilestoneKind;
}

export interface CheckpointMark {
    checkpoint: Checkpoint;
    milestone: Milestone;
    y: number;
}

const SOMEDAY_SPACING = 42;
const SOMEDAY_TOP = 20;

function dateY(scale: TimeScale, date: string): number {
    return yOfDate(scale, parseISO(`${date}T12:00:00`));
}

function inRange(scale: TimeScale, y: number): boolean {
    return y >= SOMEDAY_Y && y <= scale.height - BOTTOM_PAD;
}

/** The milestone the road leads to now: the first open one in the path's order. */
export function activeMilestone(milestones: Milestone[]): Milestone | null {
    return milestones.find(milestone => !milestone.done) ?? null;
}

/**
 * Where each milestone's ring sits. Open dated ones at their date, undated ones stacked in the
 * Someday zone in their order, done ones on the past road on the day they were done. Rings that
 * would fall outside the drawn time range are left out.
 */
export function milestoneMarks(milestones: Milestone[], scale: TimeScale): MilestoneMark[] {
    const active = activeMilestone(milestones);
    const someday = milestones.filter(milestone => !milestone.done && !milestone.targetDate);
    const spacing = Math.min(SOMEDAY_SPACING, (SOMEDAY_Y - SOMEDAY_TOP) / Math.max(1, someday.length));
    const marks: MilestoneMark[] = [];
    milestones.forEach(milestone => {
        if (milestone.done) {
            if (!milestone.doneOn) return;
            const y = dateY(scale, milestone.doneOn);
            if (inRange(scale, y)) marks.push({ milestone, y, kind: 'done' });
            return;
        }
        if (!milestone.targetDate) {
            const place = someday.indexOf(milestone) + 1;
            marks.push({ milestone, y: SOMEDAY_Y - place * spacing + 6, kind: 'someday' });
            return;
        }
        const y = dateY(scale, milestone.targetDate);
        if (inRange(scale, y)) marks.push({ milestone, y, kind: milestone === active ? 'active' : 'future' });
    });
    return marks;
}

/** Ticks for the dated checkpoints of open milestones. */
export function checkpointMarks(milestones: Milestone[], scale: TimeScale): CheckpointMark[] {
    return milestones
        .filter(milestone => !milestone.done)
        .flatMap(milestone => milestone.checkpoints
            .filter(checkpoint => checkpoint.targetDate)
            .map(checkpoint => ({ checkpoint, milestone, y: dateY(scale, checkpoint.targetDate as string) })))
        .filter(mark => inRange(scale, mark.y));
}

/** Where the future road stops brightening: the active milestone's ring, or today without one. */
export function brightUntilY(marks: MilestoneMark[]): number {
    const active = marks.find(mark => mark.kind === 'active');
    return active && active.y < TODAY_Y ? active.y : TODAY_Y;
}
