import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Box, InputBase } from '@mui/material';
import { keyframes } from '@mui/system';
import { notesService } from '../../services/api/notesService';

const NOTE_TITLE_LENGTH = 60;

const noteIn = keyframes`
    from { opacity: 0; transform: translate(-12px, -4px); }
    to { opacity: 1; transform: translate(-12px, -12px); }
`;

function titleOf(body: string): string {
    const firstLine = body.split('\n')[0].trim();
    return firstLine.slice(0, NOTE_TITLE_LENGTH) || 'Focus note';
}

/**
 * A note written during total focus. It lives where it was placed and is saved as a real note on the
 * Notes page once typing pauses, so nothing is lost when focus ends. Its position is not kept.
 */
export function FocusNote({ x, y, onDiscard }: { x: number; y: number; onDiscard: () => void }) {
    const [text, setText] = useState('');
    const textRef = useRef('');
    const savedRef = useRef('');
    const noteIdRef = useRef<Promise<string> | null>(null);

    const flush = useCallback(() => {
        const body = textRef.current.trim();
        if (body === savedRef.current) return;
        if (!body && !noteIdRef.current) return;
        savedRef.current = body;
        noteIdRef.current ??= notesService.createNote(null).then(note => note.id);
        noteIdRef.current
            .then(id => notesService.updateNote(id, { title: titleOf(body), content: body }, true))
            .catch(error => console.error('Could not save the focus note:', error));
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(flush, 800);
        return () => window.clearTimeout(timer);
    }, [text, flush]);

    // Leaving total focus unmounts the note: whatever was typed still gets saved.
    useEffect(() => () => flush(), [flush]);

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') (event.target as HTMLElement).blur();
    };

    return (
        <Box
            data-focus-note
            sx={{
                position: 'absolute',
                left: x,
                top: y,
                width: 230,
                p: 1.5,
                borderRadius: 2.5,
                border: 1,
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                transform: 'translate(-12px, -12px)',
                animation: `${noteIn} 220ms ease-out`,
            }}
        >
            <InputBase
                autoFocus
                multiline
                fullWidth
                minRows={2}
                value={text}
                placeholder="Write a note…"
                onChange={event => {
                    textRef.current = event.target.value;
                    setText(event.target.value);
                }}
                onKeyDown={onKeyDown}
                onBlur={() => {
                    if (!textRef.current.trim()) onDiscard();
                    else flush();
                }}
                inputProps={{ 'aria-label': 'Focus note', maxLength: 2000 }}
                sx={{ fontSize: '0.95rem', lineHeight: 1.5, alignItems: 'flex-start' }}
            />
        </Box>
    );
}
