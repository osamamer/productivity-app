import { memo } from 'react';
import { monthTicks, SOMEDAY_Y, type TimeScale, TODAY_Y } from './roadLayout';

export const AXIS_WIDTH = 76;

/** Month labels down the pinned left column, Someday at the top and the Today pill at today's line. */
export const VortexAxis = memo(function VortexAxis({ scale }: { scale: TimeScale }) {
    return (
        <svg width={AXIS_WIDTH} height={scale.height} viewBox={`0 0 ${AXIS_WIDTH} ${scale.height}`} aria-hidden="true">
            {monthTicks(scale).map(tick => (
                <g key={tick.y}>
                    <line x1={58} x2={AXIS_WIDTH} y1={tick.y} y2={tick.y} stroke="rgba(244,242,255,0.14)" />
                    <text x={14} y={tick.labelY + 4} fontSize={tick.yearStart ? 11 : 10.5} fontWeight={tick.yearStart ? 800 : 500}
                          fill={tick.yearStart ? '#F4F2FF' : 'rgba(244,242,255,0.55)'}>
                        {tick.label}
                    </text>
                </g>
            ))}
            <text x={14} y={SOMEDAY_Y - 50} fontSize={10.5} fill="rgba(244,242,255,0.55)" letterSpacing=".08em">SOMEDAY</text>
            <rect x={6} y={TODAY_Y - 11} width={54} height={22} rx={11} fill="rgba(244,242,255,.1)" />
            <text x={33} y={TODAY_Y + 4} fontSize={11} fontWeight={800} textAnchor="middle" fill="#F4F2FF">Today</text>
        </svg>
    );
});
