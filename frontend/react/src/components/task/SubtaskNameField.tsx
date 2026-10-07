import React from 'react';
import { TextField } from '@mui/material';

type SubtaskNameFieldProps = {
    value: string;
    completed: boolean;
    readOnly: boolean;
    inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
    onChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onBlur: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onKeyDown: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    ariaLabel: string;
};

export const SubtaskNameField = React.memo(function SubtaskNameField({
    value,
    completed,
    readOnly,
    inputRef,
    onChange,
    onBlur,
    onKeyDown,
    ariaLabel,
}: SubtaskNameFieldProps) {
    return (
        <TextField
            value={value}
            inputRef={inputRef}
            autoComplete="off"
            fullWidth
            multiline
            minRows={1}
            maxRows={3}
            variant="standard"
            onChange={onChange}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            InputProps={{ disableUnderline: true, readOnly }}
            inputProps={{
                draggable: false,
                'data-subtask-name-input': 'true',
                'aria-label': ariaLabel,
            }}
            sx={{
                '& .MuiInputBase-root': { alignItems: 'flex-start', padding: 0 },
                '& .MuiInputBase-input': {
                    color: completed ? 'text.disabled' : 'text.primary',
                    textDecoration: completed ? 'line-through' : 'none',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    fontWeight: 'inherit',
                    letterSpacing: 'inherit',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    maxHeight: '4.35em',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    textAlign: 'left',
                    padding: 0,
                    cursor: 'text',
                },
            }}
        />
    );
});
