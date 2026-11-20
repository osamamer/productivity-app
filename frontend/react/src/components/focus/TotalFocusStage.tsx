import { MouseEvent, ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';
import { FocusNote } from './FocusNote';
import { takeFocusOrigin } from './focusOrigin';

const fadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;
const fadeOut = keyframes`
    from { opacity: 1; }
    to { opacity: 0; }
`;

const GLIDE_MS = 380;
const GLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

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
export function TotalFocusStage({ header, children, leaving = false }: { header: ReactNode; children: ReactNode; leaving?: boolean }) {
    const [notes, setNotes] = useState<PlacedNote[]>([]);
    const nextId = useRef(0);
    const cardRef = useRef<HTMLDivElement>(null);

    // The card glides from where the pomodoro was in the list to the middle of the screen.
    useLayoutEffect(() => {
        const origin = takeFocusOrigin();
        const card = cardRef.current;
        if (!origin || !card || leaving) return;
        const target = card.getBoundingClientRect();
        if (target.width === 0 || target.height === 0) return;
        const dx = (origin.left + origin.width / 2) - (target.left + target.width / 2);
        const dy = (origin.top + origin.height / 2) - (target.top + target.height / 2);
        card.animate(
            [
                { transform: `translate(${dx}px, ${dy}px) scale(${origin.width / target.width}, ${origin.height / target.height})` },
                { transform: 'translate(0, 0) scale(1, 1)' },
            ],
            { duration: GLIDE_MS, easing: GLIDE_EASING },
        );
        // Only the first render of the stage glides; it is mounted once per total focus.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                animation: `${leaving ? fadeOut : fadeIn} ${GLIDE_MS}ms ${GLIDE_EASING} forwards`,
            }}
        >
            {header}
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', px: 2 }}>
                <Box ref={cardRef} data-focus-card sx={{ pointerEvents: 'auto', cursor: 'default', zoom: 1.15, width: 'min(420px, 100%)' }}>
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
