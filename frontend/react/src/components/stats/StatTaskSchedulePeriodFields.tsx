import { Stack, TextField, Typography } from '@mui/material';
import { AppDateField } from '../input/AppPickerFields';
import { currentWeekStartDate, normalizeStatWeekStartDate } from './statRecurringTaskUtils';

export const MAX_STAT_TASK_SCHEDULE_WEEKS = 104;

type Props = {
    weekStartDate: string;
    weekCount: number;
    disabled?: boolean;
    onWeekStartDateChange: (date: string) => void;
    onWeekCountChange: (weekCount: number) => void;
};

export function StatTaskSchedulePeriodFields({
    weekStartDate,
    weekCount,
    disabled = false,
    onWeekStartDateChange,
    onWeekCountChange,
}: Props) {
    const countInvalid = !Number.isInteger(weekCount)
        || weekCount < 1
        || weekCount > MAX_STAT_TASK_SCHEDULE_WEEKS;

    return (
        <Stack spacing={1}>
            <AppDateField
                label="Week of"
                value={weekStartDate}
                onChange={date => onWeekStartDateChange(normalizeStatWeekStartDate(date))}
                minDate={currentWeekStartDate()}
                disabled={disabled}
                error={!weekStartDate}
                helperText={!weekStartDate ? 'Choose a week.' : 'Choose any date in the week.'}
            />
            <TextField
                label="Number of weeks"
                type="number"
                size="small"
                fullWidth
                value={weekCount}
                onChange={event => onWeekCountChange(Number(event.target.value))}
                disabled={disabled}
                error={countInvalid}
                inputProps={{ min: 1, max: MAX_STAT_TASK_SCHEDULE_WEEKS, step: 1 }}
                helperText={countInvalid
                    ? `Choose between 1 and ${MAX_STAT_TASK_SCHEDULE_WEEKS} weeks.`
                    : 'Repeat on the selected days each week.'}
            />
            <Typography variant="caption" color="text.secondary">
                Weeks start on Sunday. Tasks are scheduled on the selected days for each chosen week.
            </Typography>
        </Stack>
    );
}
