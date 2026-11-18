import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { hourTicks, PlannedBlock, ScreenBlock } from './dayTimelineLayout';
import { PlannedTooltip, ScreenTooltip } from './timelineBlocks';
import { hatch, plannedBlockStyle, screenBlockStyle } from './timelineStyles';

const LABEL_WIDTH = 72;
const PLANNED_ROW_HEIGHT = 22;
const SCREEN_HEIGHT = 30;
const MIN_TRACK_WIDTH = 640;
// Hour labels this close to an edge would hang outside the track.
const LABEL_EDGE_PCT = 3;

interface DayTimelineProps {
    windowStart: number;
    windowEnd: number;
    now: number;
    planned: PlannedBlock[];
    screen: ScreenBlock[];
}

function LaneLabel({ children }: { children: string }) {
    return (
        <Typography variant="caption" color="text.secondary" fontWeight={650} sx={{ width: LABEL_WIDTH, flexShrink: 0, pt: 0.5 }}>
            {children}
        </Typography>
    );
}

/** Planned events and focus sessions above what was actually on screen, on one time axis. */
export function DayTimeline({ windowStart, windowEnd, now, planned, screen }: DayTimelineProps) {
    const theme = useTheme();
    const span = windowEnd - windowStart;
    const ticks = hourTicks(windowStart, windowEnd);
    const tickEvery = Math.max(1, Math.ceil(ticks.length / 12));
    const plannedRows = Math.max(1, ...planned.map(block => block.row + 1));
    const nowPct = now > windowStart && now < windowEnd ? ((now - windowStart) / span) * 100 : null;

    const overlays = (
        <>
            {ticks.filter(tick => tick < windowEnd).map(tick => (
                <Box key={tick} sx={{ position: 'absolute', top: 0, bottom: 0, left: `${((tick - windowStart) / span) * 100}%`, width: '1px', bgcolor: 'divider', pointerEvents: 'none' }} />
            ))}
            {nowPct !== null && <Box sx={{ position: 'absolute', top: -2, bottom: -2, left: `${nowPct}%`, width: 2, bgcolor: 'primary.main', borderRadius: 1, pointerEvents: 'none', zIndex: 2 }} />}
        </>
    );

    return (
        <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
            <Stack spacing={1} sx={{ minWidth: MIN_TRACK_WIDTH + LABEL_WIDTH }}>
                <Stack direction="row">
                    <Box sx={{ width: LABEL_WIDTH, flexShrink: 0 }} />
                    <Box sx={{ position: 'relative', flex: 1, height: 18 }}>
                        {ticks.filter((tick, index) => {
                            const pct = ((tick - windowStart) / span) * 100;
                            return index % tickEvery === 0 && pct >= LABEL_EDGE_PCT && pct <= 100 - LABEL_EDGE_PCT;
                        }).map(tick => (
                            <Typography key={tick} variant="caption" color="text.secondary" sx={{ position: 'absolute', left: `${((tick - windowStart) / span) * 100}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                                {format(tick, 'ha').toLowerCase()}
                            </Typography>
                        ))}
                    </Box>
                </Stack>

                <Stack direction="row">
                    <LaneLabel>Planned</LaneLabel>
                    <Box sx={{ position: 'relative', flex: 1, height: plannedRows * PLANNED_ROW_HEIGHT + 4 }}>
                        {overlays}
                        {planned.length === 0 && (
                            <Typography variant="caption" color="text.disabled" sx={{ position: 'absolute', top: 3, left: 8 }}>Nothing planned on the clock</Typography>
                        )}
                        {planned.map(block => (
                            <Tooltip key={block.id} arrow title={<PlannedTooltip block={block} />}>
                                <Box sx={{
                                    position: 'absolute',
                                    top: block.row * PLANNED_ROW_HEIGHT + 2,
                                    height: PLANNED_ROW_HEIGHT - 4,
                                    left: `${block.leftPct}%`,
                                    width: `max(3px, ${block.widthPct}%)`,
                                    borderRadius: 1,
                                    px: 0.5,
                                    overflow: 'hidden',
                                    zIndex: 1,
                                    ...plannedBlockStyle(block, theme),
                                }}>
                                    <Typography variant="caption" noWrap component="div" sx={{ lineHeight: `${PLANNED_ROW_HEIGHT - 6}px` }}>{block.title}</Typography>
                                </Box>
                            </Tooltip>
                        ))}
                    </Box>
                </Stack>

                <Stack direction="row">
                    <LaneLabel>Screen</LaneLabel>
                    <Box sx={{ position: 'relative', flex: 1, height: SCREEN_HEIGHT }}>
                        {overlays}
                        {screen.map(block => (
                            <Tooltip key={`${block.kind}-${block.start}`} arrow title={<ScreenTooltip block={block} />}>
                                <Box sx={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: `${block.leftPct}%`,
                                    width: `max(1px, ${block.widthPct}%)`,
                                    borderRadius: block.kind === 'app' || block.kind === 'switching' ? 0.75 : 0,
                                    zIndex: 1,
                                    ...screenBlockStyle(block, theme),
                                }} />
                            </Tooltip>
                        ))}
                    </Box>
                </Stack>

                <Stack direction="row" spacing={2} sx={{ pl: `${LABEL_WIDTH}px` }} flexWrap="wrap" useFlexGap>
                    <Legend swatch={{ bgcolor: alpha(theme.palette.text.primary, 0.06) }} label="Away" />
                    <Legend swatch={{ background: hatch(alpha(theme.palette.text.primary, 0.2)) }} label="Not tracked" />
                    <Legend swatch={{ background: `repeating-linear-gradient(90deg, #5b8def 0 4px, #e0864a 4px 8px)`, opacity: 0.75 }} label="Switching between apps" />
                </Stack>
            </Stack>
        </Box>
    );
}

function Legend({ swatch, label }: { swatch: object; label: string }) {
    return (
        <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 14, height: 10, borderRadius: 0.5, ...swatch }} />
            <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Stack>
    );
}
