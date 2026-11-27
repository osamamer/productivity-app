import { Box, Button } from '@mui/material';
import { useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import type { Milestone, Path, PathRoad, PathView } from '../../types/Path';
import { PathColumnHeader, COLUMN_HEADER_HEIGHT } from './PathColumnHeader';
import { PathRoadSvg } from './PathRoadSvg';
import { moveBefore } from './pathsSummary';
import { COLUMN_WIDTH, type TimeScale, TODAY_Y } from './roadLayout';
import { AXIS_WIDTH, VortexAxis } from './VortexAxis';
import { VortexBackground } from './VortexBackground';

interface Props {
    roads: PathRoad[];
    scale: TimeScale;
    view: PathView;
    onOpenPath: (path: Path) => void;
    onOpenMilestone: (path: Path, milestone: Milestone) => void;
    onReorder: (pathIds: string[]) => void;
}

interface Tip {
    text: string;
    x: number;
    y: number;
}

const VOID = '#050507';

/** The dark panel of roads: time scrolls vertically (future up), paths sideways. */
export function PathsVortex({ roads, scale, view, onOpenPath, onOpenMilestone, onReorder }: Props) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const columnsRef = useRef<HTMLDivElement>(null);
    const positions = useRef(new Map<string, number>());
    const dragged = useRef<string | null>(null);
    const [tip, setTip] = useState<Tip | null>(null);
    const order = roads.map(road => road.path.id).join(',');
    const custom = view.sort === 'CUSTOM';

    const scrollToToday = (smooth: boolean) => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const top = COLUMN_HEADER_HEIGHT + TODAY_Y - scroller.clientHeight * 0.55;
        if (smooth && typeof scroller.scrollTo === 'function') scroller.scrollTo({ top, behavior: 'smooth' });
        else scroller.scrollTop = top;
    };

    useLayoutEffect(() => scrollToToday(false), []);

    // Columns slide to their new places when the order changes.
    useLayoutEffect(() => {
        const columns = columnsRef.current;
        if (!columns) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        Array.from(columns.children).forEach(child => {
            const element = child as HTMLElement;
            const id = element.dataset.pathId ?? '';
            const left = element.getBoundingClientRect().left;
            const before = positions.current.get(id);
            positions.current.set(id, left);
            if (before === undefined || before === left || reduceMotion) return;
            element.style.transition = 'none';
            element.style.transform = `translateX(${before - left}px)`;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                element.style.transition = '';
                element.style.transform = '';
            }));
        });
    }, [order]);

    const showTip = (event: PointerEvent) => {
        const marked = (event.target as Element).closest?.('[data-tip]');
        const text = marked?.getAttribute('data-tip');
        setTip(text ? { text, x: event.clientX, y: event.clientY } : null);
    };

    const drop = (targetId: string) => (event: DragEvent) => {
        event.preventDefault();
        const movedId = dragged.current;
        dragged.current = null;
        if (!custom || !movedId) return;
        const next = moveBefore(roads.map(road => road.path.id), movedId, targetId);
        if (next.join(',') !== order) onReorder(next);
    };

    return (
        <Box sx={{ position: 'relative', borderRadius: 4, overflow: 'hidden', background: VOID, color: '#F4F2FF', isolation: 'isolate', flex: 1, minHeight: 0 }}>
            <VortexBackground />
            <Box ref={scrollerRef} data-testid="paths-vortex" onScroll={() => setTip(null)}
                 sx={{ height: { xs: 'calc(100vh - 220px)', md: 'max(560px, calc(100vh - 170px))' }, overflow: 'auto', overscrollBehavior: 'contain', scrollbarColor: 'rgba(255,255,255,.22) transparent' }}>
                <Box sx={{ display: 'flex', width: 'max-content', minWidth: '100%' }}>
                    <Box sx={{ position: 'sticky', left: 0, zIndex: 4, flexShrink: 0, width: AXIS_WIDTH, background: 'linear-gradient(90deg, rgba(5,5,7,.92) 72%, transparent)' }}>
                        <Box sx={{ height: COLUMN_HEADER_HEIGHT, position: 'sticky', top: 0 }} />
                        <VortexAxis scale={scale} />
                    </Box>
                    <Box ref={columnsRef} sx={{ display: 'flex', flex: 1 }} onPointerMove={showTip} onPointerLeave={() => setTip(null)}>
                        {roads.map(road => (
                            <Box key={road.path.id} data-path-id={road.path.id}
                                 sx={{
                                     flex: `1 0 ${COLUMN_WIDTH}px`, display: 'flex', flexDirection: 'column', alignItems: 'center',
                                     opacity: road.path.paused ? 0.45 : 1,
                                     transition: 'transform .45s cubic-bezier(.22,1,.36,1)',
                                     '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                                     '& svg': { display: 'block' },
                                     '& .path-week-dash': { transition: 'opacity .15s, stroke-width .15s' },
                                     '& .path-week:hover .path-week-dash': { opacity: '1 !important', strokeWidth: 3.4 },
                                     '& .path-milestone': { cursor: 'pointer', outline: 'none' },
                                     '& .path-milestone:focus-visible ellipse:first-of-type': { strokeWidth: 3.4 },
                                 }}>
                                <PathColumnHeader
                                    road={road}
                                    draggable={custom}
                                    onOpen={() => onOpenPath(road.path)}
                                    onDragStart={event => {
                                        dragged.current = road.path.id;
                                        event.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDrop={drop(road.path.id)}
                                />
                                <PathRoadSvg road={road} scale={scale} shape={view.shape} edges={view.edges}
                                             onOpenMilestone={milestone => onOpenMilestone(road.path, milestone)} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
            <Button size="small" onClick={() => scrollToToday(true)}
                    sx={{
                        position: 'absolute', right: 14, bottom: 14, zIndex: 5, color: '#F4F2FF', fontWeight: 700, borderRadius: 999,
                        textTransform: 'none', px: 1.5, background: 'rgba(244,242,255,.1)', border: '1px solid rgba(244,242,255,0.14)',
                        backdropFilter: 'blur(6px)', '&:hover': { background: 'rgba(244,242,255,.18)' },
                    }}>
                Today
            </Button>
            {tip && (
                <Box role="tooltip" sx={{
                    position: 'fixed', left: tip.x, top: tip.y, zIndex: 20, pointerEvents: 'none', fontSize: '0.75rem', fontWeight: 700,
                    color: '#0b0c10', background: '#F4F2FF', px: 1.125, py: 0.5, borderRadius: '7px', whiteSpace: 'nowrap',
                    transform: 'translate(14px, -50%)', boxShadow: '0 6px 18px rgba(0,0,0,.45)',
                }}>
                    {tip.text}
                </Box>
            )}
        </Box>
    );
}
