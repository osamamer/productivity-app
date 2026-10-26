import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, DialogActions, DialogContent, DialogTitle,
    Popover, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { MouseEvent } from 'react';
import { AppTimeField } from '../input/AppPickerFields';
import { StatDefinition, StatWeeklyTaskScheduleDraft } from '../../types/Stats';
import {
    STAT_RECURRENCE_DAYS, defaultStatWeeklyTaskScheduleDraft, isStatScheduleDayAvailable,
} from './statRecurringTaskUtils';

type PopupPosition = { top: number; left: number };

type Props = {
    open: boolean;
    definition: StatDefinition | null;
    saving?: boolean;
    loading?: boolean;
    error?: string | null;
    anchorPosition?: PopupPosition | null;
    initialDraft?: StatWeeklyTaskScheduleDraft | null;
    onClose: () => void;
    onConfirm: (draft: StatWeeklyTaskScheduleDraft) => void;
};

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

function priorityBucket(importance: number): number {
    if (importance > 7) return 9;
    if (importance > 4) return 6;
    return 3;
}

export function StatWeeklyTaskScheduleDialog({
    open,
    definition,
    saving = false,
    loading = false,
    error = null,
    anchorPosition = null,
    initialDraft = null,
    onClose,
    onConfirm,
}: Props) {
    const [draft, setDraft] = useState<StatWeeklyTaskScheduleDraft>(defaultStatWeeklyTaskScheduleDraft());

    useEffect(() => {
        if (!open) return;
        setDraft(initialDraft ?? defaultStatWeeklyTaskScheduleDraft(definition?.name ?? ''));
    }, [open, definition?.id, definition?.name, initialDraft]);

    const timeMissing = !/^\d{2}:\d{2}$/.test(draft.timeOfDay);
    const nameMissing = !draft.taskName.trim();

    const updateDays = (_event: MouseEvent<HTMLElement>, selectedDays: typeof draft.daysOfWeek) => {
        setDraft(current => ({ ...current, daysOfWeek: selectedDays }));
    };

    return (
        <Popover
            open={open && Boolean(anchorPosition)}
            onClose={saving ? undefined : onClose}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition ?? { top: 0, left: 0 }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
                paper: {
                    sx: {
                        width: { xs: 'calc(100vw - 24px)', sm: 400 },
                        maxHeight: 'calc(100vh - 24px)',
                        overflow: 'auto',
                    },
                },
            }}
        >
            <Box>
                <DialogTitle>Change this week's schedule{definition ? ` for ${definition.name}` : ''}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">
                            Changes apply only to the remaining days of this week. Tasks outside this week are unchanged.
                        </Typography>
                        {loading ? (
                            <Typography variant="body2" color="text.secondary">Loading this week's tasks…</Typography>
                        ) : (
                            <>
                                <Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                        Days this week
                                    </Typography>
                                    <ToggleButtonGroup
                                        value={draft.daysOfWeek}
                                        onChange={updateDays}
                                        aria-label="Days this week"
                                        disabled={saving}
                                        fullWidth
                                        size="small"
                                    >
                                        {STAT_RECURRENCE_DAYS.map(day => (
                                            <ToggleButton
                                                key={day.value}
                                                value={day.value}
                                                aria-label={day.value}
                                                disabled={!isStatScheduleDayAvailable(day.value, draft.timeOfDay)}
                                            >
                                                {day.label}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                </Box>
                                <AppTimeField
                                    label="Task time"
                                    value={draft.timeOfDay}
                                    onChange={timeOfDay => setDraft(current => ({
                                        ...current,
                                        timeOfDay,
                                        daysOfWeek: current.daysOfWeek.filter(day =>
                                            isStatScheduleDayAvailable(day, timeOfDay),
                                        ),
                                    }))}
                                    disabled={saving}
                                    error={timeMissing}
                                    helperText={timeMissing ? 'Choose a task time.' : undefined}
                                />
                                <Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                        Priority
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        {PRIORITY_OPTIONS.map(option => {
                                            const selected = priorityBucket(draft.importance) === option.value;
                                            return (
                                                <Chip
                                                    key={option.label}
                                                    label={option.label}
                                                    onClick={() => setDraft(current => ({
                                                        ...current,
                                                        importance: option.value,
                                                    }))}
                                                    disabled={saving}
                                                    sx={{
                                                        border: `1px solid ${option.color}`,
                                                        color: selected ? '#fff' : option.color,
                                                        backgroundColor: selected ? option.color : 'transparent',
                                                        fontWeight: selected ? 600 : 400,
                                                    }}
                                                />
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            </>
                        )}
                        {error && <Alert severity="error">{error}</Alert>}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => onConfirm(draft)}
                        disabled={saving || loading || !definition || nameMissing || timeMissing
                        }
                    >
                        {saving ? 'Saving…' : 'Save this week'}
                    </Button>
                </DialogActions>
            </Box>
        </Popover>
    );
}
