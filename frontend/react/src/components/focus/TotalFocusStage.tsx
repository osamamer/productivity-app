import { MouseEvent, ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';
import { FocusNote } from './FocusNote';
import { takeFocusOrigin } from './focusOrigin';
import { focusNotesForSession, rememberFocusNotes, PlacedFocusNote } from './focusNotes';

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

// Clicks on these leave the page alone: they are controls or text the person is already using.
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, [contenteditable], [data-focus-card], [data-focus-note]';

/**
 * The whole screen during total focus: the running pomodoro in the middle, and a click anywhere
 * else starts a note right where it was clicked.
 */
export function TotalFocusStage({ sessionId, header, children, leaving = false }: { sessionId: string; header: ReactNode; children: ReactNode; leaving?: boolean }) {
    const [notes, setNotes] = useState<PlacedFocusNote[]>(() => focusNotesForSession(sessionId));
    const nextId = useRef(Math.max(0, ...notes.map(note => note.id + 1)));
    const [newNoteId, setNewNoteId] = useState<number | null>(null);
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
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: 'translate(0, 0)' },
            ],
            { duration: GLIDE_MS, easing: GLIDE_EASING },
        );
        // Only the first render of the stage glides; it is mounted once per total focus.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const replaceNotes = (updated: PlacedFocusNote[]) => {
        rememberFocusNotes(sessionId, updated);
        setNotes(updated);
    };

    const placeNote = (event: MouseEvent<HTMLDivElement>) => {
        if (leaving || (event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
        const { clientX, clientY } = event;
        const id = nextId.current++;
        replaceNotes([...notes, { id, x: clientX, y: clientY, text: '' }]);
        setNewNoteId(id);
    };

    return (
        <Box
            onClick={placeNote}
            sx={{
                position: 'fixed',
                inset: 0,
                zIndex: 1,
                pointerEvents: leaving ? 'none' : 'auto',
                overflow: 'hidden',
                backgroundColor: 'background.default',
                cursor: 'text',
                animation: `${leaving ? fadeOut : fadeIn} ${GLIDE_MS}ms ${GLIDE_EASING} forwards`,
            }}
        >
            {!leaving && header}
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', px: 2 }}>
                <Box ref={cardRef} data-focus-card sx={{ pointerEvents: leaving ? 'none' : 'auto', cursor: 'default', width: 'min(468px, 100%)' }}>
                    {children}
                </Box>
            </Box>
            {notes.map(note => (
                <FocusNote
                    key={note.id}
                    note={note}
                    autoFocus={note.id === newNoteId}
                    onChange={value => replaceNotes(notes.map(item => item.id === note.id ? { ...item, text: value } : item))}
                    onDiscard={() => replaceNotes(notes.filter(item => item.id !== note.id))}
                />
            ))}
        </Box>
    );
}
