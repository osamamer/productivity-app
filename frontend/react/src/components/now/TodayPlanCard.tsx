import { Box, Card, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { Activity } from '../../types/Activity';
import { activityHex } from '../activity/activityColors';
import { NowPlan, PlannedChunk } from './nowPlan';

function ChunkRow({ chunk, activity, state }: { chunk: PlannedChunk; activity: Activity | undefined; state: 'now' | 'later' | 'past' }) {
    const theme = useTheme();
    const color = activityHex(activity?.color, theme.palette.text.secondary);
    return (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{
            py: 1, px: 1.25, borderRadius: 1.5,
            bgcolor: state === 'now' ? alpha(color, 0.12) : 'transparent',
            opacity: state === 'past' ? 0.55 : 1,
        }}>
            <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: color }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={state === 'now' ? 700 : 550} noWrap>{chunk.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {format(chunk.start, 'h:mm a')} – {format(chunk.end, 'h:mm a')}{activity ? ` · ${activity.name}` : ''}
                </Typography>
            </Box>
            {state === 'now' && <Typography variant="caption" fontWeight={700} color="primary">Now</Typography>}
        </Stack>
    );
}

/** The rest of today's plan: what is on now, then what is next, then what is done. */
export function TodayPlanCard({ plan, activities }: { plan: NowPlan; activities: Activity[] }) {
    const byId = new Map(activities.map(activity => [activity.id, activity]));
    const activityOf = (chunk: PlannedChunk) => (chunk.activityId ? byId.get(chunk.activityId) : undefined);
    const empty = !plan.current && plan.upcoming.length === 0 && plan.past.length === 0;

    return (
        <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Today's plan</Typography>
            {empty && <Typography variant="body2" color="text.secondary">Nothing planned on the clock today. Plan chunks in the calendar's day view.</Typography>}
            <Stack spacing={0.25}>
                {plan.current && <ChunkRow chunk={plan.current} activity={activityOf(plan.current)} state="now" />}
                {plan.upcoming.map(chunk => <ChunkRow key={chunk.id} chunk={chunk} activity={activityOf(chunk)} state="later" />)}
                {plan.past.map(chunk => <ChunkRow key={chunk.id} chunk={chunk} activity={activityOf(chunk)} state="past" />)}
            </Stack>
        </Card>
    );
}
