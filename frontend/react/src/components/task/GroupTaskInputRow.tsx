import React, { useState } from 'react';
import { Box, Checkbox } from '@mui/material';
import { keyframes } from '@mui/system';
import { SmartTaskInput } from '../input/SmartTaskInput';
import { TaskToCreate } from '../../types/TaskToCreate';

type GroupTaskInputRowProps = {
    groupName: string;
    onSubmit: (task: TaskToCreate) => void;
    onEscape: () => void;
    onBlur: () => void;
    animate?: boolean;
};

const groupTaskInputReveal = keyframes`
    from {
        opacity: 0;
        transform: translateY(-6px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

export const GroupTaskInputRow = React.forwardRef<HTMLDivElement, GroupTaskInputRowProps>(function GroupTaskInputRow({
    groupName,
    onSubmit,
    onEscape,
    onBlur,
    animate = false,
}, ref) {
    const [importance, setImportance] = useState(0);
    const checkboxColor = importance > 7
        ? '#ef4444'
        : importance > 4
            ? '#eab308'
            : importance > 0
                ? '#1976d2'
                : 'text.disabled';

    return (
        <Box
            ref={ref}
            onClick={event => event.stopPropagation()}
            sx={{
                position: 'relative',
                borderRadius: 1.5,
                border: '1.5px solid transparent',
                backgroundColor: 'transparent',
                overflow: 'hidden',
                mb: 0.25,
                transition: 'background-color 0.2s',
                animation: animate ? `${groupTaskInputReveal} 180ms ease-out` : 'none',
                '&:hover': { backgroundColor: 'action.hover' },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, px: 0.5 }}>
                <Checkbox
                    size="small"
                    checked={false}
                    disabled
                    sx={{
                        color: checkboxColor,
                        '&.Mui-disabled': { color: checkboxColor },
                        mr: 0.5,
                    }}
                />
                <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    <SmartTaskInput
                        defaultToToday
                        autoFocus
                        placeholder="Add to group"
                        submitOnBlur
                        onSubmit={onSubmit}
                        onEscape={onEscape}
                        onBlur={onBlur}
                        onImportanceChange={setImportance}
                        showMetadataChips={false}
                        multiline
                        minRows={1}
                        maxRows={4}
                        inputProps={{
                            draggable: false,
                            'aria-label': `New task in ${groupName}`,
                        }}
                        textFieldSx={{
                            '& .MuiInput-underline:before, & .MuiInput-underline:after, & .MuiInput-underline:hover:not(.Mui-disabled):before': {
                                borderBottom: 'none',
                            },
                            '& .MuiInputBase-root': {
                                height: '100%',
                                padding: 0,
                            },
                            '& .MuiInputBase-input': {
                                color: 'text.primary',
                                fontSize: '1.05rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                maxHeight: '100%',
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                                hyphens: 'auto',
                                textAlign: 'left',
                                padding: 0,
                            },
                            '& input::placeholder, & textarea::placeholder': {
                                color: 'text.disabled',
                                opacity: 1,
                            },
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
});

GroupTaskInputRow.displayName = 'GroupTaskInputRow';
