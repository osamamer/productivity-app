import {
    Alert, Box, Button, Chip, Collapse, Stack, TextField, Typography,
} from '@mui/material';
import { useState } from 'react';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TaskToCreate } from '../../types/TaskToCreate';
import { defaultTaskRecurrence, TaskRecurrenceDraft } from '../../types/TaskRecurrence';
import { AppDateField } from '../input/AppPickerFields';
import { TaskRecurrenceCustomOptions, TaskRecurrencePicker } from '../task/TaskRecurrencePicker';
import { TaskReminderPicker } from '../task/TaskReminderPicker';

type Props = {
    initialDate: string;
    onSave: (task: TaskToCreate) => Promise<void>;
    onCancel: () => void;
};

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

function formatLocalDateTime(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function CalendarTaskForm({ initialDate, onSave, onCancel }: Props) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [importance, setImportance] = useState(0);
    const [scheduledPerformDateTime, setScheduledPerformDateTime] = useState(`${initialDate}T12:00:00`);
    const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | null>(null);
    const [recurrenceDraft, setRecurrenceDraft] = useState<TaskRecurrenceDraft>(defaultTaskRecurrence);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!name.trim()) {
            setError('Add a name for the task.');
            return;
        }
        if (recurrenceDraft.recurrenceFrequency !== 'NONE' && !scheduledPerformDateTime) {
            setError('A recurring task needs a scheduled date and time.');
            return;
        }

        const task: TaskToCreate = {
            name: name.trim(),
            description: description.trim(),
            scheduledPerformDateTime,
            reminderMinutesBefore: scheduledPerformDateTime ? reminderMinutesBefore : null,
            tag: '',
            importance,
        };
        if (recurrenceDraft.recurrenceFrequency !== 'NONE') {
            task.recurrenceFrequency = recurrenceDraft.recurrenceFrequency;
            task.recurrenceEndDate = recurrenceDraft.recurrenceEndDate;
            task.recurrenceInterval = recurrenceDraft.recurrenceInterval;
            task.recurrenceUnit = recurrenceDraft.recurrenceUnit;
            task.timeZone = recurrenceDraft.timeZone;
        }

        setSaving(true);
        setError(null);
        try {
            await onSave(task);
        } catch (saveError) {
            console.error('Failed to save calendar task:', saveError);
            setError('Failed to save the task. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDateChange = (date: Date | null) => {
        const nextDateTime = formatLocalDateTime(date);
        setScheduledPerformDateTime(nextDateTime);
        if (!nextDateTime) setReminderMinutesBefore(null);
    };

    const handleRecurrenceChange = (nextDraft: TaskRecurrenceDraft) => {
        setRecurrenceDraft(nextDraft);
        setError(null);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
            <TextField
                label="Name"
                value={name}
                onChange={event => setName(event.target.value)}
                autoFocus
                autoComplete="off"
                fullWidth
            />

            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                    Priority
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {PRIORITY_OPTIONS.map(option => {
                        const selected = importance === option.value;
                        return (
                            <Chip
                                key={option.label}
                                label={option.label}
                                onClick={() => setImportance(option.value)}
                                sx={{
                                    border: `1px solid ${option.color}`,
                                    color: selected ? '#fff' : option.color,
                                    backgroundColor: selected ? option.color : 'transparent',
                                    cursor: 'pointer',
                                    fontWeight: selected ? 600 : 400,
                                }}
                            />
                        );
                    })}
                </Box>
            </Box>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 3fr) minmax(0, 1fr)' },
                            gap: 1.25,
                            alignItems: 'start',
                        }}
                    >
                        <DateTimePicker
                            label="Scheduled"
                            value={scheduledPerformDateTime ? new Date(scheduledPerformDateTime) : null}
                            onChange={handleDateChange}
                            closeOnSelect={false}
                            ampm={false}
                            slotProps={{
                                field: { clearable: true },
                                actionBar: { actions: ['cancel', 'accept'] },
                                textField: { size: 'small', fullWidth: true },
                            }}
                        />
                        <TaskRecurrencePicker
                            value={recurrenceDraft}
                            onChange={handleRecurrenceChange}
                            showEndDate={false}
                            showCustomOptions={false}
                        />
                    </Box>

                    <Collapse in={recurrenceDraft.recurrenceFrequency !== 'NONE'} timeout={180} unmountOnExit>
                        <Box sx={{
                            mt: 1.25,
                            display: 'grid',
                            gridTemplateColumns: recurrenceDraft.recurrenceFrequency === 'CUSTOM'
                                ? { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }
                                : 'minmax(0, 1fr)',
                            gap: 1.25,
                            alignItems: 'start',
                        }}>
                            {recurrenceDraft.recurrenceFrequency === 'CUSTOM' && (
                                <TaskRecurrenceCustomOptions
                                    value={recurrenceDraft}
                                    onChange={handleRecurrenceChange}
                                />
                            )}
                            <AppDateField
                                label="Repeat until (optional)"
                                value={recurrenceDraft.recurrenceEndDate ?? ''}
                                onChange={recurrenceEndDate => handleRecurrenceChange({
                                    ...recurrenceDraft,
                                    recurrenceEndDate: recurrenceEndDate || null,
                                })}
                            />
                        </Box>
                    </Collapse>
                </Box>
            </LocalizationProvider>

            <TaskReminderPicker
                value={reminderMinutesBefore}
                disabled={!scheduledPerformDateTime}
                onChange={setReminderMinutesBefore}
            />

            <TextField
                label="Description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                autoComplete="off"
                multiline
                minRows={3}
                maxRows={8}
                fullWidth
                placeholder="Add a note"
            />

            {error && <Alert severity="error">{error}</Alert>}

            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button onClick={onCancel} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => void submit()}
                    disabled={saving || !name.trim()}
                >
                    {saving ? 'Saving…' : 'Add task'}
                </Button>
            </Stack>
        </Box>
    );
}
