import { memo, useId } from 'react';
import type { PathEdges, PathRoad, PathShape } from '../../types/Path';
import {
    COLUMN_WIDTH, edgePath, roadGeometry, roadPhase, SOMEDAY_Y, type TimeScale, TODAY_Y, weekRow, BOTTOM_PAD,
} from './roadLayout';
import { centreDashOpacity, futureColor, wallStyle } from './roadStyle';
import { todayText, weekLabel } from './signalText';
import { currentWeek } from './pathsSummary';

interface Props {
    road: PathRoad;
    scale: TimeScale;
    shape: PathShape;
    edges: PathEdges;
}

const VOID_INK_FAINT = 'rgba(244,242,255,.3)';

/**
 * One path's road: two dashed walls whose colour follows each past week's strength, a white
 * centre dash per week (hovering it shows `data-tip`), and today's dot. The future stays muted.
 */
export const PathRoadSvg = memo(function PathRoadSvg({ road, scale, shape, edges }: Props) {
    const id = useId().replace(/:/g, '');
    const { path, weeks } = road;
    const geometry = roadGeometry(roadPhase(path.id), shape === 'CURVED');
    const height = scale.height;
    const bottom = height - BOTTOM_PAD;
    const offset = (y: number) => Math.max(0, Math.min(1, y / height)).toFixed(5);
    const muted = futureColor(path.color);

    const wallStops: [number, string, number][] = [[0, muted, 0.08], [SOMEDAY_Y, muted, 0.3], [TODAY_Y, muted, 0.85]];
    const glowStops: [number, string, number][] = [[0, muted, 0], [TODAY_Y, muted, 0.16]];
    weeks.forEach((week, index) => {
        const row = weekRow(weeks.length - 1 - index);
        const style = wallStyle(week.strength, path.color, edges);
        wallStops.push([row.top, style.color, style.opacity], [row.bottom, style.color, style.opacity]);
        glowStops.push([row.top, style.color, style.glow], [row.bottom, style.color, style.glow]);
    });
    wallStops.sort((a, b) => a[0] - b[0]);
    glowStops.sort((a, b) => a[0] - b[0]);

    const now = currentWeek(road);
    const strengthNow = now?.strength ?? 0;
    const todayColor = strengthNow > 0 ? path.color : VOID_INK_FAINT;
    const todayX = geometry.center(TODAY_Y);

    return (
        <svg width={COLUMN_WIDTH} height={height} viewBox={`0 0 ${COLUMN_WIDTH} ${height}`} role="img" aria-label={`${path.name} path`}>
            <defs>
                <linearGradient id={`wall-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
                    {wallStops.map(([y, color, opacity], index) => (
                        <stop key={index} offset={offset(y)} stopColor={color} stopOpacity={opacity} />
                    ))}
                </linearGradient>
                <linearGradient id={`glow-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
                    {glowStops.map(([y, color, opacity], index) => (
                        <stop key={index} offset={offset(y)} stopColor={color} stopOpacity={opacity} />
                    ))}
                </linearGradient>
                <filter id={`soft-${id}`} x="-50%" y="-5%" width="200%" height="110%"><feGaussianBlur stdDeviation="3" /></filter>
                <filter id={`dot-${id}`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6" /></filter>
            </defs>

            {weeks.map((week, index) => {
                const row = weekRow(weeks.length - 1 - index);
                const dash = edgePath(geometry, 0, row.top + 4, row.bottom - 4);
                return (
                    <g key={week.weekStart} className="path-week" data-tip={weekLabel(path, week)}>
                        <path className="path-week-dash" d={dash} fill="none" stroke="#FFFFFF" strokeWidth={2.4}
                              strokeLinecap="round" opacity={centreDashOpacity(week.strength)} />
                        <path d={dash} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" />
                    </g>
                );
            })}

            {([-1, 1] as const).map(side => {
                const wall = edgePath(geometry, side, 0, bottom);
                return (
                    <g key={side}>
                        <path d={wall} fill="none" stroke={`url(#glow-${id})`} strokeWidth={4} filter={`url(#soft-${id})`} />
                        <path d={wall} fill="none" stroke={`url(#wall-${id})`} strokeWidth={2.2} strokeDasharray="6 5" />
                    </g>
                );
            })}

            <line x1={0} x2={COLUMN_WIDTH} y1={TODAY_Y} y2={TODAY_Y} stroke={VOID_INK_FAINT} strokeDasharray="2 5" />
            {strengthNow >= 1 && (
                <circle cx={todayX} cy={TODAY_Y} r={12} fill={todayColor} opacity={0.25} filter={`url(#dot-${id})`} />
            )}
            <circle cx={todayX} cy={TODAY_Y} r={7} fill={todayColor} />
            <text x={todayX + geometry.width(TODAY_Y) / 2 + 6} y={TODAY_Y + 4} fontSize={11.5} fontWeight={800} fill={todayColor}>
                {todayText(path, now)}
            </text>
        </svg>
    );
});
