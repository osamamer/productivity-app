import { Box, ButtonBase } from '@mui/material';
import type { DragEvent } from 'react';
import type { PathRoad } from '../../types/Path';
import { PATH_ICON_COMPONENTS } from './pathIcons';
import { recentStrength } from './pathsSummary';
import { reinforcementColor } from './roadStyle';
import { signalSummary } from './signalText';

export const COLUMN_HEADER_HEIGHT = 58;

interface Props {
    road: PathRoad;
    draggable: boolean;
    onOpen: () => void;
    onDragStart: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
}

/** A road's name, icon, signal and 4-week strength chip, pinned at the top of its column. */
export function PathColumnHeader({ road, draggable, onOpen, onDragStart, onDrop }: Props) {
    const { path } = road;
    const Icon = PATH_ICON_COMPONENTS[path.icon] ?? PATH_ICON_COMPONENTS.mind;
    const recent = recentStrength(road.weeks);
    return (
        <Box
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={draggable ? event => event.preventDefault() : undefined}
            onDrop={onDrop}
            sx={{
                alignSelf: 'stretch', position: 'sticky', top: 0, zIndex: 3, height: COLUMN_HEADER_HEIGHT,
                boxSizing: 'border-box', px: 2, pt: 1.5, display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: 1, cursor: draggable ? 'grab' : 'default',
                background: 'linear-gradient(rgba(5,5,7,.95) 55%, transparent)',
            }}
        >
            <ButtonBase onClick={onOpen} aria-label={`Edit ${path.name}`}
                        sx={{ display: 'block', textAlign: 'left', borderRadius: 1, minWidth: 0, '&:focus-visible': { outline: '2px solid #A395F2' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, fontWeight: 800, fontSize: '0.95rem' }}>
                    <Icon sx={{ color: path.color, fontSize: 17 }} />
                    <span>{path.name}</span>
                    {path.paused && <Box component="span" sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(244,242,255,0.55)' }}>paused</Box>}
                </Box>
                <Box sx={{ fontSize: '0.7rem', color: 'rgba(244,242,255,0.55)', mt: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>
                    {signalSummary(path)}
                </Box>
            </ButtonBase>
            <Box component="span" title="Last 4 weeks" sx={{
                fontSize: '0.7rem', fontWeight: 800, px: 1, py: 0.25, borderRadius: 999, color: '#0b0c10', flexShrink: 0,
                background: reinforcementColor(recent) ?? 'rgba(244,242,255,0.14)',
            }}>
                {Math.round(recent * 100)}%
            </Box>
        </Box>
    );
}
