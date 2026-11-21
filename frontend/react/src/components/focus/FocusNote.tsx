import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Box, InputBase } from '@mui/material';
import { keyframes } from '@mui/system';
import { notesService } from '../../services/api/notesService';
import { PlacedFocusNote } from './focusNotes';

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
export function FocusNote({ note, onDiscard }: { note: PlacedFocusNote; onDiscard: () => void }) {
    const [text, setText] = useState(note.text);
    const noteRef = useRef(note);

    const flush = useCallback(() => {
        const current = noteRef.current;
        const body = current.text.trim();
        if (body === current.savedText || (!body && !current.noteId)) return;
        current.noteId ??= notesService.createNote(null).then(created => created.id);
        const noteId = current.noteId;
        current.pendingSave = current.pendingSave.then(async () => {
            if (body === current.savedText) return;
            const id = await noteId;
            await notesService.updateNote(id, { title: titleOf(body), content: body }, true);
            current.savedText = body;
        }).catch(error => console.error('Could not save the focus note:', error));
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
                left: note.x,
                top: note.y,
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
                    noteRef.current.text = event.target.value;
                    setText(event.target.value);
                }}
                onKeyDown={onKeyDown}
                onBlur={() => {
                    if (!noteRef.current.text.trim()) onDiscard();
                    else flush();
                }}
                inputProps={{ 'aria-label': 'Focus note', maxLength: 2000 }}
                sx={{ fontSize: '0.95rem', lineHeight: 1.5, alignItems: 'flex-start' }}
            />
        </Box>
    );
}
