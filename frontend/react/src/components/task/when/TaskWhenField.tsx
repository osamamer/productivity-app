import { useRef, useState, type ReactNode } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Popover, Stack, Tab, Tabs, Typography } from '@mui/material';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import { addDays, format } from 'date-fns';
import { AppDateField, AppTimeField } from '../../input/AppPickerFields';
import { repeatSummary } from '../../../../../shared/repeatRule.ts';
import { RepeatEditor } from './RepeatEditor';
import { ReminderChoice } from './ReminderChoice';
import { ScopeChoice } from './ScopeChoice';
import {
    describeChange,
    reminderLabel,
    scheduleLabel,
    scheduleOf,
    type ChangeScope,
    type WhenChange,
    type WhenDraft,
} from './whenModel';

type Props = {
    value: WhenDraft;
    /** A task that already repeats: changes to its date, time or reminder ask "this occurrence or all". */
    repeating: boolean;
    /** Subtasks cannot repeat on their own. */
    canRepeat: boolean;
    /** Offer "Repeat subtasks" (only when the task has subtasks). */
    showRepeatSubtasks: boolean;
    disabled?: boolean;
    onSave: (change: WhenChange) => void | Promise<void>;
};

const SEGMENT_SX = {
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    px: 1.25,
    minWidth: 0,
    whiteSpace: 'nowrap',
    '& + &': { borderLeft: 1, borderColor: 'divider' },
    '& svg': { fontSize: 18, color: 'text.secondary', flexShrink: 0 },
} as const;

function dayKey(offset: number): string {
    return format(addDays(new Date(), offset), 'yyyy-MM-dd');
}

/**
 * One row that always stays the same height, showing the date and time, how it repeats and the reminder.
 * Clicking it opens a popup with a Date and time tab and a Repeat tab; nothing is saved until Done.
 */
export function TaskWhenField({ value, repeating, canRepeat, showRepeatSubtasks, disabled = false, onSave }: Props) {
    const anchorRef = useRef<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'when' | 'repeat'>('when');
    const [draft, setDraft] = useState(value);
    const [scheduleScope, setScheduleScope] = useState<ChangeScope>('occurrence');
    const [reminderScope, setReminderScope] = useState<ChangeScope>('occurrence');
    const [saving, setSaving] = useState(false);

    const openPopup = (nextTab: 'when' | 'repeat') => {
        setDraft(value);
        setTab(nextTab);
        setScheduleScope('occurrence');
        setReminderScope('occurrence');
        setOpen(true);
    };
    const update = (changes: Partial<WhenDraft>) => setDraft(previous => {
        const next = { ...previous, ...changes };
        return next.date ? next : { ...next, reminderMinutesBefore: null };
    });
    const change = describeChange(value, draft, { scheduleScope, reminderScope });
    const save = async () => {
        if (!change.scheduleChanged && !change.reminderChanged && !change.repeatChanged) {
            setOpen(false);
            return;
        }
        setSaving(true);
        try {
            await onSave(change);
            setOpen(false);
        } finally {
            setSaving(false);
        }
    };
    // A repeat chosen in this popup applies to the whole series already; only an existing one asks.
    const askScope = repeating && value.repeat.kind !== 'NONE';
    const quickDates: { label: string; date: string }[] = [
        { label: 'Today', date: dayKey(0) },
        { label: 'Tomorrow', date: dayKey(1) },
        { label: 'Next week', date: dayKey(7) },
    ];

    return (
        <>
            <Box
                component="button"
                type="button"
                ref={anchorRef}
                disabled={disabled}
                onClick={() => openPopup('when')}
                aria-label={`When: ${scheduleLabel(value)}, ${repeatSummary(value.repeat)}, ${reminderLabel(value.reminderMinutesBefore)}`}
                sx={{
                    containerType: 'inline-size',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    height: 44,
                    px: 0.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    font: 'inherit',
                    fontSize: '0.9rem',
                    textAlign: 'left',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                    overflow: 'hidden',
                    '&:hover': disabled ? undefined : { borderColor: 'text.secondary' },
                    '& .when-short': { display: 'none' },
                    '@container (max-width: 440px)': {
                        '& .when-full': { display: 'none' },
                        '& .when-short': { display: 'inline' },
                        '& .when-reminder-text': { display: 'none' },
                    },
                }}
            >
                <Box sx={{ ...SEGMENT_SX, flexShrink: 0 }}>
                    <CalendarTodayRoundedIcon />
                    <Box component="span" sx={{ color: value.date ? 'text.primary' : 'text.disabled' }}>
                        {scheduleLabel(value)}
                    </Box>
                </Box>
                {canRepeat && (
                    <Box sx={{ ...SEGMENT_SX, flex: 1 }}>
                        <RepeatRoundedIcon />
                        <Box
                            component="span"
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', color: value.repeat.kind === 'NONE' ? 'text.disabled' : 'text.primary' }}
                        >
                            <span className="when-full">{repeatSummary(value.repeat)}</span>
                            <span className="when-short">{repeatSummary(value.repeat, true)}</span>
                        </Box>
                    </Box>
                )}
                <Box sx={{ ...SEGMENT_SX, flexShrink: 0, ...(canRepeat ? {} : { flex: 1 }) }}>
                    <NotificationsNoneRoundedIcon sx={value.reminderMinutesBefore !== null ? { color: 'primary.main !important' } : undefined} />
                    <Box
                        component="span"
                        className="when-reminder-text"
                        sx={{ color: value.reminderMinutesBefore === null ? 'text.disabled' : 'text.primary' }}
                    >
                        {reminderLabel(value.reminderMinutesBefore, canRepeat && value.repeat.kind !== 'NONE')}
                    </Box>
                </Box>
            </Box>

            <Popover
                open={open}
                anchorEl={anchorRef.current}
                onClose={() => setOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                onClick={event => event.stopPropagation()}
                slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 32px)', p: 2, borderRadius: 3, mt: 0.75 } } }}
            >
                <Tabs
                    value={tab}
                    onChange={(_event, next: 'when' | 'repeat') => setTab(next)}
                    sx={{ minHeight: 36, mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 36, textTransform: 'none', px: 1.5 } }}
                >
                    <Tab value="when" label="Date and time" />
                    {canRepeat && <Tab value="repeat" label="Repeat" />}
                </Tabs>

                {tab === 'when' ? (
                    <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {quickDates.map(quick => (
                                <Button
                                    key={quick.label}
                                    size="small"
                                    variant={draft.date === quick.date ? 'contained' : 'outlined'}
                                    disableElevation
                                    onClick={() => update({ date: quick.date })}
                                    sx={{ textTransform: 'none', borderRadius: 999, py: 0.25 }}
                                >
                                    {quick.label}
                                </Button>
                            ))}
                            <Button
                                size="small"
                                variant={draft.date ? 'outlined' : 'contained'}
                                disableElevation
                                disabled={draft.repeat.kind !== 'NONE'}
                                onClick={() => update({ date: '' })}
                                sx={{ textTransform: 'none', borderRadius: 999, py: 0.25 }}
                            >
                                No date
                            </Button>
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 1 }}>
                            <AppDateField label="Date" value={draft.date} onChange={date => update({ date })} />
                            <AppTimeField
                                label="Time"
                                value={draft.time}
                                disabled={!draft.date}
                                onChange={time => update({ time: time || '09:00' })}
                            />
                        </Box>
                        {askScope && change.scheduleChanged && draft.date && (
                            <ScopeChoice label="Apply the new date and time to" value={scheduleScope} onChange={setScheduleScope} />
                        )}
                        <WhenSection label="Reminder">
                            <ReminderChoice
                                value={draft.reminderMinutesBefore}
                                disabled={!draft.date}
                                onChange={reminderMinutesBefore => update({ reminderMinutesBefore })}
                            />
                        </WhenSection>
                        {askScope && change.reminderChanged && (
                            <ScopeChoice label="Apply the new reminder to" value={reminderScope} onChange={setReminderScope} />
                        )}
                    </Stack>
                ) : (
                    <RepeatEditor
                        value={draft.repeat}
                        startDate={draft.date}
                        onChange={repeat => update({ repeat })}
                    >
                        {showRepeatSubtasks && (
                            <FormControlLabel
                                control={(
                                    <Checkbox
                                        size="small"
                                        checked={draft.repeatSubtasks}
                                        onChange={event => update({ repeatSubtasks: event.target.checked })}
                                    />
                                )}
                                label={<Typography variant="body2">Repeat subtasks with each occurrence</Typography>}
                            />
                        )}
                    </RepeatEditor>
                )}

                {tab === 'repeat' && askScope && change.repeatChanged && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        Repeat changes apply to every upcoming occurrence.
                    </Typography>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                    <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={saving || (draft.repeat.kind !== 'NONE' && !scheduleOf(draft))}
                        onClick={() => void save()}
                        sx={{ textTransform: 'none' }}
                    >
                        Done
                    </Button>
                </Box>
            </Popover>
        </>
    );
}

function WhenSection({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
            {children}
        </Box>
    );
}
