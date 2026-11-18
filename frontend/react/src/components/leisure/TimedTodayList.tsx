import { Box, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { Activity } from '../../types/Activity';
import { ActivitySession, sessionElapsedMs } from '../../types/ActivitySession';
import { activityHex } from '../activity/activityColors';
import { formatScreenDuration } from '../day/screenTimeText';
import { timeByActivity } from './nowPlan';

/** What was actually timed today, as a quiet section under the plan. */
export function TimedTodayList({ sessions, activities, now }: { sessions: ActivitySession[]; activities: Activity[]; now: number }) {
    const theme = useTheme();
    const byId = new Map(activities.map(activity => [activity.id, activity]));
    const totals = timeByActivity(sessions, now);
    if (totals.length === 0) return null;
    const longest = totals[0].ms;

    return (
        <Box sx={{ mt: 4, textAlign: 'left' }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.5 }}>
                Timed today
            </Typography>
            <Stack spacing={1.25} sx={{ px: 1 }}>
                {totals.map(total => {
                    const activity = total.activityId ? byId.get(total.activityId) : undefined;
                    const color = activityHex(activity?.color, theme.palette.text.secondary);
                    return (
                        <Box key={total.activityId ?? 'none'}>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2">{activity?.name ?? 'Other'}</Typography>
                                <Typography variant="body2" color="text.secondary">{formatScreenDuration(total.ms)}</Typography>
                            </Stack>
                            <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover', mt: 0.5 }}>
                                <Box sx={{ height: '100%', width: `${(total.ms / longest) * 100}%`, borderRadius: 2, bgcolor: color }} />
                            </Box>
                        </Box>
                    );
                })}
            </Stack>
            <Stack spacing={0.5} sx={{ mt: 2, px: 1 }}>
                {[...sessions].reverse().map(session => (
                    <Stack key={session.id} direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="caption" noWrap>{session.title}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {format(Date.parse(session.startedAt), 'h:mm a')} · {formatScreenDuration(sessionElapsedMs(session, now))}{session.active ? ' · running' : ''}
                        </Typography>
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
}
