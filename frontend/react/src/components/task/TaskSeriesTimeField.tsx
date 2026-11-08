import { useEffect, useState } from 'react';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { Box, Button, CircularProgress, Popover, Stack, Typography } from '@mui/material';
import { AppTimeField } from '../input/AppPickerFields';

type Props = {
    startDateTime: string;
    disabled?: boolean;
    onApply: (time: string) => Promise<void>;
};

function timeFromDateTime(value: string): string {
    const match = value.match(/T(\d{2}:\d{2})/);
    return match?.[1] ?? '';
}

export function TaskSeriesTimeField({ startDateTime, disabled = false, onApply }: Props) {
    const savedTime = timeFromDateTime(startDateTime);
    const [time, setTime] = useState(savedTime);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTime(savedTime);
        setError(false);
    }, [savedTime]);

    const apply = async () => {
        if (!time || time === savedTime || saving) return;
        setSaving(true);
        setError(false);
        try {
            await onApply(time);
            setAnchorEl(null);
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ mt: 1.25 }}>
            <Button
                size="small"
                startIcon={<AccessTimeRoundedIcon fontSize="small" />}
                disabled={disabled || saving}
                onClick={event => {
                    setTime(savedTime);
                    setError(false);
                    setAnchorEl(event.currentTarget);
                }}
            >
                Change series time
            </Button>
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => {
                    if (!saving) setAnchorEl(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{ paper: { role: 'dialog', 'aria-label': 'Change series time', sx: { p: 2, width: 300, maxWidth: 'calc(100vw - 32px)' } } }}
            >
                <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                        Update the time for upcoming occurrences.
                    </Typography>
                    <AppTimeField
                        label="Series time"
                        value={time}
                        onChange={setTime}
                        disabled={disabled || saving}
                    />
                    {error && (
                        <Typography variant="caption" color="error" role="alert">
                            Could not update the series time.
                        </Typography>
                    )}
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" disabled={saving} onClick={() => setAnchorEl(null)}>
                            Cancel
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => void apply()}
                            disabled={disabled || saving || !time || time === savedTime}
                            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
                        >
                            Apply to series
                        </Button>
                    </Stack>
                </Stack>
            </Popover>
        </Box>
    );
}
