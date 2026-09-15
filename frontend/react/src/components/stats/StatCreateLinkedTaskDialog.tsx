import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, DialogActions, DialogContent, DialogTitle,
    Popover, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { StatDefinition, StatRecurringTaskDraft } from '../../types/Stats';
import { defaultStatRecurringTaskDraft } from './statRecurringTaskUtils';
import { StatRecurringTaskOptions } from './StatRecurringTaskDialog';

type PopupPosition = { top: number; left: number };

type Props = {
    open: boolean;
    definition: StatDefinition | null;
    saving?: boolean;
    error?: string | null;
    anchorPosition?: PopupPosition | null;
    onClose: () => void;
    onCreate: (taskName: string, importance: number) => void;
    onCreateRecurring: (taskName: string, recurrence: StatRecurringTaskDraft) => void;
};

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

export function StatCreateLinkedTaskDialog({
    open,
    definition,
    saving = false,
    error = null,
    anchorPosition = null,
    onClose,
    onCreate,
    onCreateRecurring,
}: Props) {
    const [taskName, setTaskName] = useState('');
    const [importance, setImportance] = useState(3);
    const [mode, setMode] = useState<'once' | 'recurring'>('once');
    const [recurrence, setRecurrence] = useState<StatRecurringTaskDraft>(defaultStatRecurringTaskDraft);

    useEffect(() => {
        if (!open) return;
        setTaskName(definition?.name ?? '');
        setImportance(3);
        setMode('once');
        setRecurrence(defaultStatRecurringTaskDraft());
    }, [definition?.id, definition?.name, open]);

    const trimmedTaskName = taskName.trim();
    const customDaysMissing = recurrence.recurrenceFrequency === 'CUSTOM'
        && recurrence.recurrenceDaysOfWeek.length === 0;
    const timeMissing = !/^\d{2}:\d{2}$/.test(recurrence.timeOfDay);
    const canCreate = Boolean(definition && trimmedTaskName && !saving
        && (mode === 'once' || (!customDaysMissing && !timeMissing)));

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
            <DialogTitle>
                Create linked task{definition ? ` for ${definition.name}` : ''}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        label="Task name"
                        value={taskName}
                        onChange={event => setTaskName(event.target.value)}
                        disabled={saving}
                    />
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                            Priority
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            {PRIORITY_OPTIONS.map(option => {
                                const selected = importance === option.value;
                                return (
                                    <Chip
                                        key={option.label}
                                        label={option.label}
                                        onClick={() => setImportance(option.value)}
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
                    {definition?.type === 'BOOLEAN' && !definition.recurringTaskSeriesId && (
                        <>
                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                size="small"
                                value={mode}
                                onChange={(_, value: 'once' | 'recurring' | null) => {
                                    if (value) setMode(value);
                                }}
                                disabled={saving}
                            >
                                <ToggleButton value="once">One-time</ToggleButton>
                                <ToggleButton value="recurring">Recurring</ToggleButton>
                            </ToggleButtonGroup>
                            {mode === 'recurring' && (
                                <StatRecurringTaskOptions
                                    value={{ ...recurrence, importance }}
                                    onChange={setRecurrence}
                                    showPriority={false}
                                    disabled={saving}
                                    timeError={timeMissing ? 'Choose a task time.' : undefined}
                                />
                            )}
                        </>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => mode === 'recurring'
                        ? onCreateRecurring(trimmedTaskName, { ...recurrence, importance, taskName: trimmedTaskName })
                        : onCreate(trimmedTaskName, importance)}
                    disabled={!canCreate}
                >
                    {saving ? 'Creating…' : mode === 'recurring' ? 'Create recurring task' : 'Create task'}
                </Button>
            </DialogActions>
            </Box>
        </Popover>
    );
}
