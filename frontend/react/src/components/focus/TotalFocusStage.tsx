import { MouseEvent, ReactNode, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { FocusNote } from './FocusNote';

interface PlacedNote {
    id: number;
    x: number;
    y: number;
}

// Clicks on these leave the page alone: they are controls or text the person is already using.
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, [contenteditable], [data-focus-card], [data-focus-note]';

/**
 * The whole screen during total focus: the running pomodoro in the middle, and a click anywhere
 * else starts a note right where it was clicked.
 */
export function TotalFocusStage({ header, children }: { header: ReactNode; children: ReactNode }) {
    const [notes, setNotes] = useState<PlacedNote[]>([]);
    const nextId = useRef(0);

    const placeNote = (event: MouseEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
        const { clientX, clientY } = event;
        const id = nextId.current++;
        setNotes(current => [...current, { id, x: clientX, y: clientY }]);
    };

    return (
        <Box
            onClick={placeNote}
            sx={{
                position: 'fixed',
                inset: 0,
                zIndex: 1,
                overflow: 'hidden',
                backgroundColor: 'background.default',
                cursor: 'text',
            }}
        >
            {header}
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', px: 2 }}>
                <Box data-focus-card sx={{ pointerEvents: 'auto', cursor: 'default', zoom: 1.25, width: 'min(560px, 100%)' }}>
                    {children}
                </Box>
            </Box>
            {notes.map(note => (
                <FocusNote
                    key={note.id}
                    x={note.x}
                    y={note.y}
                    onDiscard={() => setNotes(current => current.filter(item => item.id !== note.id))}
                />
            ))}
        </Box>
    );
}
