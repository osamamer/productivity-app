import type { PathRoad, PathSort, WeekStrength } from '../../types/Path';

const RECENT_WEEKS = 4;

/** Mean strength of the last four weeks (the current one by pace), each capped at 1. */
export function recentStrength(weeks: WeekStrength[]): number {
    const recent = weeks.slice(-RECENT_WEEKS);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, week) => sum + Math.min(week.strength, 1), 0) / recent.length;
}

export function currentWeek(road: PathRoad): WeekStrength | null {
    return road.weeks[road.weeks.length - 1] ?? null;
}

export function isOnPace(road: PathRoad): boolean {
    return (currentWeek(road)?.strength ?? 0) >= 1;
}

/** Paused paths are left out of the count: they are not expected to move. */
export function onPaceCount(roads: PathRoad[]): { onPace: number; active: number } {
    const active = roads.filter(road => !road.path.paused);
    return { onPace: active.filter(isOnPace).length, active: active.length };
}

export function sortRoads(roads: PathRoad[], sort: PathSort): PathRoad[] {
    const byOrder = (a: PathRoad, b: PathRoad) => a.path.displayOrder - b.path.displayOrder || a.path.name.localeCompare(b.path.name);
    const sorted = [...roads];
    if (sort === 'CUSTOM') return sorted.sort(byOrder);
    const direction = sort === 'ATTENTION' ? 1 : -1;
    return sorted.sort((a, b) => direction * (recentStrength(a.weeks) - recentStrength(b.weeks)) || byOrder(a, b));
}

/** The ids in their new order after dragging `movedId` onto `targetId`'s place. */
export function moveBefore(ids: string[], movedId: string, targetId: string): string[] {
    if (movedId === targetId) return ids;
    const without = ids.filter(id => id !== movedId);
    const movingRight = ids.indexOf(movedId) < ids.indexOf(targetId);
    const index = without.indexOf(targetId) + (movingRight ? 1 : 0);
    return [...without.slice(0, index), movedId, ...without.slice(index)];
}
