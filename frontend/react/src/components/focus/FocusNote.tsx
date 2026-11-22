import { KeyboardEvent, useState } from 'react';
import { Box, InputBase } from '@mui/material';
import { keyframes } from '@mui/system';
import { PlacedFocusNote } from './focusNotes';

const noteIn = keyframes`
    from { opacity: 0; transform: translate(-12px, -4px); }
    to { opacity: 1; transform: translate(-12px, -12px); }
`;

export function FocusNote({ note, onChange, onDiscard, autoFocus }: {
    note: PlacedFocusNote;
    onChange: (text: string) => void;
    onDiscard: () => void;
    autoFocus: boolean;
}) {
    const [text, setText] = useState(note.text);

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
                autoFocus={autoFocus}
                multiline
                fullWidth
                minRows={2}
                value={text}
                placeholder="Write a note…"
                onChange={event => {
                    onChange(event.target.value);
                    setText(event.target.value);
                }}
                onKeyDown={onKeyDown}
                onBlur={() => {
                    if (!text.trim()) onDiscard();
                }}
                inputProps={{ 'aria-label': 'Focus note', maxLength: 2000 }}
                sx={{ fontSize: '0.95rem', lineHeight: 1.5, alignItems: 'flex-start' }}
            />
        </Box>
    );
}
