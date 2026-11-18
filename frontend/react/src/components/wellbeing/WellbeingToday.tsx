import { Alert, Button, Skeleton, Stack } from '@mui/material';
import { format, parseISO } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import CalendarViewDayRoundedIcon from '@mui/icons-material/CalendarViewDayRounded';
import { useDayOverview } from '../../hooks/useDayOverview';
import { ScreenTimeCard } from '../day/ScreenTimeCard';

/** Today's plan beside today's screen time, over the same waking-day window as the Day page. */
export function WellbeingToday() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { overview, error } = useDayOverview(today);

    if (error && !overview) return <Alert severity="error">{error}</Alert>;
    if (!overview) return <Skeleton variant="rounded" height={260} />;

    return (
        <Stack spacing={1.5}>
            <ScreenTimeCard overview={overview} windowStart={parseISO(overview.dayStart)} windowEnd={parseISO(overview.dayEnd)} />
            <Stack direction="row" justifyContent="flex-end">
                <Button component={RouterLink} to={`/calendar?day=${today}`} startIcon={<CalendarViewDayRoundedIcon />}>
                    Open today in the calendar
                </Button>
            </Stack>
        </Stack>
    );
}
