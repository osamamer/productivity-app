import { useState } from 'react';
import { Box, ButtonBase, Collapse, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import HistoryToggleOffRoundedIcon from '@mui/icons-material/HistoryToggleOffRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { format } from 'date-fns';
import { getHomeTimedTodayExpanded, setHomeTimedTodayExpanded } from '../../services/utils/homePreferences';
import { Activity } from '../../types/Activity';
import { ActivitySession, sessionElapsedMs } from '../../types/ActivitySession';
import { activityHex } from '../activity/activityColors';
import { formatScreenDuration } from '../day/screenTimeText';
import { timeByActivity } from './leisureTime';

/** What was timed today, a collapsible section styled like Home's "Today's events". */
export function TimedTodayList({ sessions, activities, now }: { sessions: ActivitySession[]; activities: Activity[]; now: number }) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(getHomeTimedTodayExpanded);
    const byId = new Map(activities.map(activity => [activity.id, activity]));
    const totals = timeByActivity(sessions, now);
    const longest = totals[0]?.ms ?? 0;
    const empty = sessions.length === 0;

    const toggle = () => {
        if (empty) return;
        setHomeTimedTodayExpanded(!expanded);
        setExpanded(!expanded);
    };

    return (
        <Box component="section" aria-labelledby="timed-today-heading" sx={{ mt: 2, mb: 1 }}>
            <ButtonBase
                disableRipple
                disabled={empty}
                aria-expanded={expanded}
                aria-controls="home-timed-today-list"
                onClick={toggle}
                sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', width: '100%', px: 0.5, py: 0.5, borderRadius: 1, textAlign: 'left' }}
            >
                <Box sx={{ width: 38, height: 38, mr: 0.5, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                    {expanded
                        ? <HistoryRoundedIcon color="primary" fontSize="small" />
                        : <HistoryToggleOffRoundedIcon color="primary" fontSize="small" />}
                </Box>
                <Typography id="timed-today-heading" variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Timed today
                </Typography>
                <Box
                    aria-label={`${sessions.length} timers`}
                    sx={{
                        ml: 0.75, width: 22, height: 22, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%',
                        color: 'primary.main', backgroundColor: alpha(theme.palette.primary.main, 0.12),
                        fontSize: '0.75rem', fontWeight: 600, lineHeight: 1,
                    }}
                >
                    {sessions.length}
                </Box>
            </ButtonBase>

            <Collapse
                id="home-timed-today-list"
                in={expanded && !empty}
                timeout={{ enter: 420, exit: 440 }}
                easing={{ enter: 'cubic-bezier(0.4, 0, 0.2, 1)', exit: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
                mountOnEnter
            >
                <Box
                    sx={{
                        ml: 5.75, mr: 2, pt: 0.75, position: 'relative', textAlign: 'left',
                        '&::before': {
                            content: '""', position: 'absolute', left: -23, top: 0, bottom: 0,
                            borderLeft: '1px solid', borderColor: 'divider', pointerEvents: 'none',
                        },
                    }}
                >
                    <Stack spacing={1.25}>
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
                    <Stack spacing={0.5} sx={{ mt: 2 }}>
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
            </Collapse>
        </Box>
    );
}
