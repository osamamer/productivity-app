import { useState } from 'react';
import { Avatar, Box, IconButton, Popover, Stack, Typography } from '@mui/material';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import { ActivityPicker } from '../activity/ActivityPicker';
import type { Activity } from '../../types/Activity';
import { UsageApp } from '../../services/desktop';
import { AppTime } from './dayTimelineLayout';
import { formatScreenDuration } from './screenTimeText';

const SHOWN_APPS = 6;

/** Per-app time as plain bars. No targets or warnings: the numbers are for noticing, not judging. */
export function ScreenTimeSummary({ appTimes, apps, activities = [], activityByApp, assignActivity }: {
    appTimes: AppTime[];
    apps: Record<string, UsageApp>;
    activities?: Activity[];
    activityByApp?: Record<string, string>;
    assignActivity?: (appId: string, activityId: string | null) => Promise<void>;
}) {
    const [target, setTarget] = useState<{ app: AppTime; anchor: HTMLElement } | null>(null);
    const [expanded, setExpanded] = useState(false);
    if (appTimes.length === 0) {
        return <Typography variant="body2" color="text.secondary">No app time recorded in this window yet.</Typography>;
    }
    const longest = appTimes[0].ms;
    const shown = expanded ? appTimes : appTimes.slice(0, SHOWN_APPS);
    const restMs = appTimes.slice(SHOWN_APPS).reduce((total, app) => total + app.ms, 0);

    return (
        <Stack spacing={1}>
            {shown.map(app => (
                <Stack key={app.appId} direction="row" spacing={1.25} alignItems="center">
                    <Avatar src={apps[app.appId]?.icon ?? undefined} variant="rounded" sx={{ width: 22, height: 22, bgcolor: app.color, fontSize: 12 }}>
                        {app.name.charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography variant="body2" noWrap>{app.name}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{formatScreenDuration(app.ms)}</Typography>
                        </Stack>
                        <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover', mt: 0.5 }}>
                            <Box sx={{ height: '100%', width: `${(app.ms / longest) * 100}%`, borderRadius: 2, bgcolor: app.color }} />
                        </Box>
                    </Box>
                    {assignActivity && activities.length > 0 && (
                        <IconButton size="small" aria-label={`Classify ${app.name} screen time`}
                            title={activities.find(item => item.id === activityByApp?.[app.appId])?.name ?? 'Classify screen time'}
                            color={activities.some(item => item.id === activityByApp?.[app.appId]) ? 'primary' : 'default'}
                            onClick={event => setTarget({ app, anchor: event.currentTarget })}>
                            <LabelOutlinedIcon fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            ))}
            {!expanded && restMs > 0 && (
                <Typography component="button" variant="caption" color="text.secondary" onClick={() => setExpanded(true)}
                    sx={{ cursor: 'pointer', alignSelf: 'flex-start', bgcolor: 'transparent', border: 0, p: 0 }}>
                    Show {appTimes.length - SHOWN_APPS} more · {formatScreenDuration(restMs)}
                </Typography>
            )}
            <Popover open={target !== null} anchorEl={target?.anchor} onClose={() => setTarget(null)}
                slotProps={{ paper: { sx: { p: 1.5, maxWidth: 300 } } }}>
                {target && (
                    <ActivityPicker activities={activities} label={`${target.app.name} counts as`}
                        value={activities.find(item => item.id === activityByApp?.[target.app.appId])?.id ?? null}
                        onChange={value => { void assignActivity?.(target.app.appId, value); setTarget(null); }} />
                )}
            </Popover>
        </Stack>
    );
}
