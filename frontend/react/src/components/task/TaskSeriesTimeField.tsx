import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
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
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ mt: 1.25 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <AppTimeField
                        label="Series time"
                        value={time}
                        onChange={setTime}
                        disabled={disabled || saving}
                        helperText="Upcoming occurrences"
                    />
                </Box>
                <Button
                    size="small"
                    onClick={() => void apply()}
                    disabled={disabled || saving || !time || time === savedTime}
                    startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                    Apply to series
                </Button>
            </Stack>
            {error && (
                <Typography variant="caption" color="error" role="alert">
                    Could not update the series time.
                </Typography>
            )}
        </Box>
    );
}
