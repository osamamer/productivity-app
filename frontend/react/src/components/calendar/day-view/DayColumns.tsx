import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { hourTicks, PlannedBlock, ScreenBlock, slotAt, type TimeInterval } from '../../day/dayTimelineLayout';
import { formatScreenDuration, formatTimeRange } from '../../day/screenTimeText';
import { PlannedTooltip, ScreenTooltip } from '../../day/timelineBlocks';
import { plannedBlockStyle, screenBlockStyle } from '../../day/timelineStyles';

const HOUR_HEIGHT = 72;
const GUTTER_WIDTH = 56;
const HEADER_HEIGHT = 32;
// Below these heights a block has no room for text; its tooltip still says what it is.
const TITLE_MIN_PX = 20;
const DETAIL_MIN_PX = 40;

interface DayColumnsProps {
    windowStart: number;
    windowEnd: number;
    now: number;
    planned: PlannedBlock[];
    // Time actually spent on activity timers; empty or absent hides the column.
    did?: PlannedBlock[];
    // Null hides the screen column: a plain browser, or a day that has not happened yet.
    screen: ScreenBlock[] | null;
    // Clicking empty space in the planned column offers to plan a chunk there, from the current hour on.
    onEditBlock?: (block: PlannedBlock) => void;
    onCreateAt?: (slot: TimeInterval, anchor: { top: number; left: number }) => void;
}

function ColumnHeader({ children }: { children: string }) {
    return (
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ flex: 1, height: HEADER_HEIGHT, lineHeight: `${HEADER_HEIGHT}px`, px: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {children}
        </Typography>
    );
}

/**
 * One day top to bottom: what was planned beside what was on screen, an hour every 72px. Place it
 * inside an element marked `data-day-scroller`, which is scrolled to bring "now" into view.
 */
export function DayColumns({ windowStart, windowEnd, now, planned, did = [], screen, onCreateAt, onEditBlock }: DayColumnsProps) {
    const theme = useTheme();
    const nowRef = useRef<HTMLDivElement | null>(null);
    const span = windowEnd - windowStart;
    const height = (span / 3_600_000) * HOUR_HEIGHT;
    const px = (pct: number) => (pct / 100) * height;
    const ticks = hourTicks(windowStart, windowEnd);
    const [hoverSlot, setHoverSlot] = useState<TimeInterval | null>(null);
    const slotFromEvent = (event: MouseEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest('[data-planned-block]')) return null;
        const rect = event.currentTarget.getBoundingClientRect();
        const slot = slotAt(windowStart, windowEnd, (event.clientY - rect.top) / rect.height);
        // Hours that are over can't be planned any more.
        return slot.end <= Date.now() ? null : slot;
    };
    const nowPct = now > windowStart && now < windowEnd ? ((now - windowStart) / span) * 100 : null;

    useEffect(() => {
        // scrollIntoView would also scroll the page sideways on narrow screens.
        const line = nowRef.current;
        const scroller = line?.closest<HTMLElement>('[data-day-scroller]');
        if (!line || !scroller) return;
        scroller.scrollTop += line.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 2;
    }, [windowStart]);

    const hourLines = ticks.map(tick => (
        <Box key={tick} sx={{ position: 'absolute', left: 0, right: 0, top: `${((tick - windowStart) / span) * 100}%`, borderTop: 1, borderColor: 'divider', pointerEvents: 'none' }} />
    ));

    return (
        <Box sx={{ position: 'relative' }}>
            <Stack direction="row" sx={{ pl: `${GUTTER_WIDTH}px`, position: 'sticky', top: 0, zIndex: 3, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                <ColumnHeader>Planned</ColumnHeader>
                {did.length > 0 && <ColumnHeader>Did</ColumnHeader>}
                {screen && <ColumnHeader>Screen</ColumnHeader>}
            </Stack>

            <Stack direction="row" sx={{ position: 'relative', height, mt: 1, mb: 2 }}>
                <Box sx={{ position: 'relative', width: GUTTER_WIDTH, flexShrink: 0 }}>
                    {ticks.map(tick => (
                        <Typography key={tick} variant="caption" color="text.secondary" sx={{ position: 'absolute', right: 8, top: `${((tick - windowStart) / span) * 100}%`, transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>
                            {format(tick, 'h a').toLowerCase()}
                        </Typography>
                    ))}
                </Box>

                <Box
                    sx={{ position: 'relative', flex: 1, mx: 0.5, cursor: onCreateAt && hoverSlot ? 'pointer' : undefined }}
                    onMouseMove={onCreateAt ? event => {
                        const slot = slotFromEvent(event);
                        setHoverSlot(current => (current?.start === slot?.start ? current : slot));
                    } : undefined}
                    onMouseLeave={onCreateAt ? () => setHoverSlot(null) : undefined}
                    onClick={onCreateAt ? event => {
                        const slot = slotFromEvent(event);
                        if (slot) onCreateAt(slot, { top: event.clientY, left: event.clientX });
                    } : undefined}
                >
                    {hourLines}
                    {hoverSlot && (
                        <Box sx={{
                            position: 'absolute',
                            top: `${((hoverSlot.start - windowStart) / span) * 100}%`,
                            height: `${((hoverSlot.end - hoverSlot.start) / span) * 100}%`,
                            left: 2,
                            right: 2,
                            border: 1,
                            borderStyle: 'dashed',
                            borderColor: 'primary.main',
                            borderRadius: 1.5,
                            px: 1,
                            pt: 0.25,
                            pointerEvents: 'none',
                        }}>
                            <Typography variant="caption" color="primary" fontWeight={650}>+ Plan {formatTimeRange(hoverSlot.start, hoverSlot.end)}</Typography>
                        </Box>
                    )}
                    {planned.length === 0 && !hoverSlot && (
                        <Typography variant="body2" color="text.disabled" sx={{ position: 'absolute', top: 8, left: 8 }}>{onCreateAt ? 'Nothing planned yet. Click a time to plan a chunk.' : 'Nothing planned on the clock'}</Typography>
                    )}
                    {planned.map(block => {
                        const blockPx = px(block.widthPct);
                        return (
                            <Tooltip key={block.id} arrow placement="right" title={<PlannedTooltip block={block} />}>
                                <Box data-planned-block
                                    role={onEditBlock && block.eventId ? 'button' : undefined}
                                    tabIndex={onEditBlock && block.eventId ? 0 : undefined}
                                    aria-label={onEditBlock && block.eventId ? `Edit ${block.title}` : undefined}
                                    onClick={event => { event.stopPropagation(); onEditBlock?.(block); }}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            onEditBlock?.(block);
                                        }
                                    }}
                                    sx={{
                                    cursor: onEditBlock && block.eventId ? 'pointer' : undefined,
                                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                                    position: 'absolute',
                                    top: `${block.leftPct}%`,
                                    height: `max(4px, ${block.widthPct}%)`,
                                    left: `calc(${(block.row / block.columns) * 100}% + 2px)`,
                                    width: `calc(${100 / block.columns}% - 4px)`,
                                    borderRadius: 1.5,
                                    px: 1,
                                    py: blockPx >= DETAIL_MIN_PX ? 0.5 : 0,
                                    overflow: 'hidden',
                                    zIndex: 1,
                                    ...plannedBlockStyle(block, theme),
                                }}>
                                    {blockPx >= TITLE_MIN_PX && <Typography variant="body2" fontWeight={650} noWrap>{block.title}</Typography>}
                                    {blockPx >= DETAIL_MIN_PX && (
                                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                                            {block.activityName ? `${block.activityName} · ` : block.kind === 'focus' ? 'Focus · ' : ''}{formatTimeRange(block.start, block.end)}
                                        </Typography>
                                    )}
                                </Box>
                            </Tooltip>
                        );
                    })}
                </Box>

                {did.length > 0 && (
                    <Box sx={{ position: 'relative', flex: 1, mx: 0.5 }}>
                        {hourLines}
                        {did.map(block => {
                            const blockPx = px(block.widthPct);
                            return (
                                <Tooltip key={block.id} arrow placement="right" title={<PlannedTooltip block={block} />}>
                                    <Box sx={{
                                        position: 'absolute',
                                        top: `${block.leftPct}%`,
                                        height: `max(4px, ${block.widthPct}%)`,
                                        left: `calc(${(block.row / block.columns) * 100}% + 2px)`,
                                        width: `calc(${100 / block.columns}% - 4px)`,
                                        borderRadius: 1.5,
                                        px: 1,
                                        overflow: 'hidden',
                                        zIndex: 1,
                                        ...plannedBlockStyle(block, theme),
                                    }}>
                                        {blockPx >= TITLE_MIN_PX && (
                                            <Typography variant="caption" fontWeight={700} noWrap component="div" sx={{ pt: 0.25 }}>
                                                {block.title}{blockPx >= DETAIL_MIN_PX ? ` · ${formatScreenDuration(block.end - block.start)}` : ''}
                                            </Typography>
                                        )}
                                    </Box>
                                </Tooltip>
                            );
                        })}
                    </Box>
                )}

                {screen && (
                    <Box sx={{ position: 'relative', flex: 1, mx: 0.5 }}>
                        {hourLines}
                        {screen.map(block => {
                            const blockPx = px(block.widthPct);
                            const label = block.kind === 'app' ? block.name : block.kind === 'switching' ? 'Switching' : null;
                            return (
                                <Tooltip key={`${block.kind}-${block.start}`} arrow placement="left" title={<ScreenTooltip block={block} />}>
                                    <Box sx={{
                                        position: 'absolute',
                                        top: `${block.leftPct}%`,
                                        height: `max(1px, ${block.widthPct}%)`,
                                        left: 2,
                                        right: 2,
                                        borderRadius: block.kind === 'app' || block.kind === 'switching' ? 1 : 0,
                                        overflow: 'hidden',
                                        zIndex: 1,
                                        ...screenBlockStyle(block, theme, 'vertical'),
                                    }}>
                                        {label && blockPx >= TITLE_MIN_PX && (
                                            <Typography variant="caption" fontWeight={700} noWrap component="div" sx={{ px: 1, pt: 0.25, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>
                                                {label}{blockPx >= DETAIL_MIN_PX ? ` · ${formatScreenDuration(block.end - block.start)}` : ''}
                                            </Typography>
                                        )}
                                    </Box>
                                </Tooltip>
                            );
                        })}
                    </Box>
                )}

                {nowPct !== null && (
                    <Box ref={nowRef} sx={{ position: 'absolute', left: GUTTER_WIDTH - 6, right: 0, top: `${nowPct}%`, zIndex: 2, pointerEvents: 'none' }}>
                        <Box sx={{ position: 'absolute', left: 0, top: -4, width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main' }} />
                        <Box sx={{ borderTop: 2, borderColor: 'primary.main' }} />
                    </Box>
                )}
            </Stack>
        </Box>
    );
}
