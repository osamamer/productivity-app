import type { ReactNode } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { format } from 'date-fns';
import { AppDateField } from '../../input/AppPickerFields';
import { AppNumberField } from '../../input/AppNumberField';
import {
    sortWeekdays,
    upcomingOccurrenceDates,
    WEEKDAYS,
    weekdayOfDateKey,
    type RepeatKind,
    type RepeatRule,
    type Weekday,
} from '../../../../../shared/repeatRule.ts';

const KINDS: { kind: RepeatKind; label: string }[] = [
    { kind: 'NONE', label: 'Never' },
    { kind: 'DAILY', label: 'Daily' },
    { kind: 'WEEKLY', label: 'Weekly' },
    { kind: 'MONTHLY', label: 'Monthly' },
];

const UNIT = { DAILY: ['day', 'days'], WEEKLY: ['week', 'weeks'], MONTHLY: ['month', 'months'] } as const;

type Props = {
    value: RepeatRule;
    onChange: (value: RepeatRule) => void;
    /** `YYYY-MM-DD` the repeat starts from; without it nothing can repeat. */
    startDate: string;
    /** Extra options under the rule, e.g. "Repeat subtasks". */
    children?: ReactNode;
};

/** Never, Daily, Weekly or Monthly, every N, weekdays for Weekly, an end date and the next few dates. */
export function RepeatEditor({ value, onChange, startDate, children }: Props) {
    const update = (changes: Partial<RepeatRule>) => onChange({ ...value, ...changes });
    const selectKind = (kind: RepeatKind) => {
        if (kind === value.kind) return;
        const days = kind === 'WEEKLY' && startDate ? [weekdayOfDateKey(startDate)] : [];
        onChange({ kind, every: 1, days, until: kind === 'NONE' ? null : value.until });
    };
    const toggleDay = (day: Weekday) => {
        const days = value.days.includes(day) ? value.days.filter(item => item !== day) : [...value.days, day];
        update({ days: sortWeekdays(days) });
    };
    const upcoming = startDate ? upcomingOccurrenceDates(value, startDate, startDate, 3) : [];

    if (!startDate) {
        return <Typography variant="body2" color="text.secondary">Pick a date first, then choose how it repeats.</Typography>;
    }

    return (
        <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {KINDS.map(option => (
                    <Chip
                        key={option.kind}
                        label={option.label}
                        size="small"
                        color={value.kind === option.kind ? 'primary' : 'default'}
                        variant={value.kind === option.kind ? 'filled' : 'outlined'}
                        onClick={() => selectKind(option.kind)}
                    />
                ))}
            </Box>
            {value.kind !== 'NONE' && (
                <>
                    {value.kind === 'WEEKLY' && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">On</Typography>
                            <Box role="group" aria-label="Repeat on" sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                                {WEEKDAYS.map(day => {
                                    const selected = value.days.includes(day);
                                    return (
                                        <Box
                                            key={day}
                                            component="button"
                                            type="button"
                                            aria-pressed={selected}
                                            aria-label={day.charAt(0) + day.slice(1).toLowerCase()}
                                            onClick={() => toggleDay(day)}
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                border: 1,
                                                borderColor: selected ? 'primary.main' : 'divider',
                                                bgcolor: selected ? 'primary.main' : 'transparent',
                                                color: selected ? 'primary.contrastText' : 'text.secondary',
                                                font: 'inherit',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {day.charAt(0)}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">Every</Typography>
                        <AppNumberField
                            value={value.every}
                            min={1}
                            max={999}
                            size="small"
                            sx={{ width: 96 }}
                            inputProps={{ 'aria-label': 'Repeat every' }}
                            onChange={event => update({ every: Math.max(1, Number(event.target.value) || 1) })}
                            onStepValueChange={every => update({ every })}
                        />
                        <Typography variant="body2">{UNIT[value.kind][value.every === 1 ? 0 : 1]}</Typography>
                    </Box>
                    <AppDateField
                        label="Until (optional)"
                        value={value.until ?? ''}
                        minDate={startDate}
                        onChange={until => update({ until: until || null })}
                    />
                    {children}
                    {upcoming.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            Next: {upcoming.map(date => format(new Date(`${date}T12:00:00`), 'EEE d MMM')).join(', ')}
                        </Typography>
                    )}
                    {value.kind === 'WEEKLY' && value.days.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                            No days chosen: repeats on {format(new Date(`${startDate}T12:00:00`), 'EEEE')}s.
                        </Typography>
                    )}
                </>
            )}
        </Stack>
    );
}
