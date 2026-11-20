import { ReactNode } from 'react';
import { Box } from '@mui/material';

const EXPAND_MS = 320;

/**
 * Opens and closes by animating the height of the grid row, so the content keeps its layout and
 * the page below moves smoothly. Content stays mounted; the caller decides what to show when closed.
 */
export function ExpandCollapse({ open, id, children }: { open: boolean; id?: string; children: ReactNode }) {
    return (
        <Box
            id={id}
            aria-hidden={!open}
            sx={{
                display: 'grid',
                gridTemplateRows: open ? '1fr' : '0fr',
                opacity: open ? 1 : 0,
                visibility: open ? 'visible' : 'hidden',
                transition: `grid-template-rows ${EXPAND_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${EXPAND_MS}ms ease, visibility ${EXPAND_MS}ms`,
                '& > .ExpandCollapse-content': { minHeight: 0, overflow: 'hidden' },
            }}
        >
            <Box className="ExpandCollapse-content">{children}</Box>
        </Box>
    );
}
