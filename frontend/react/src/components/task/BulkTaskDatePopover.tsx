import React from 'react';
import { Box, Button, Popover, Typography } from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimeField } from '@mui/x-date-pickers/TimeField';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

type BulkTaskDatePopoverProps = {
    anchorEl: HTMLElement | null;
    value: Date;
    loading?: boolean;
    onChange: (value: Date) => void;
    onApply: () => void;
    onClose: () => void;
};

export function BulkTaskDatePopover({
    anchorEl,
    value,
    loading = false,
    onChange,
    onApply,
    onClose,
}: BulkTaskDatePopoverProps) {
    return (
        <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={onClose}
            onClick={event => event.stopPropagation()}
            onMouseDown={event => event.stopPropagation()}
            anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
            transformOrigin={{ vertical: 'center', horizontal: 'left' }}
            slotProps={{
                paper: {
                    sx: {
                        p: 2,
                        borderRadius: 2.5,
                        maxWidth: 'calc(100vw - 24px)',
                    },
                },
            }}
        >
            <Box sx={{ width: 320, maxWidth: '100%' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Move selected tasks to
                </Typography>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateCalendar
                        value={value}
                        onChange={nextValue => {
                            if (nextValue) onChange(nextValue);
                        }}
                        sx={{ width: '100%' }}
                    />
                    <TimeField
                        label="Time"
                        value={value}
                        onChange={nextValue => {
                            if (nextValue) onChange(nextValue);
                        }}
                        format="HH:mm"
                        fullWidth
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                </LocalizationProvider>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                    <Button size="small" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button size="small" variant="contained" onClick={onApply} disabled={loading}>
                        {loading ? 'Moving…' : 'Move tasks'}
                    </Button>
                </Box>
            </Box>
        </Popover>
    );
}
