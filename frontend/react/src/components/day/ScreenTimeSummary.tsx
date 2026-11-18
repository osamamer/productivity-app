import { Avatar, Box, Stack, Typography } from '@mui/material';
import { UsageApp } from '../../services/desktop';
import { AppTime } from './dayTimelineLayout';
import { formatScreenDuration } from './screenTimeText';

const SHOWN_APPS = 6;

/** Per-app time as plain bars. No targets or warnings: the numbers are for noticing, not judging. */
export function ScreenTimeSummary({ appTimes, apps }: { appTimes: AppTime[]; apps: Record<string, UsageApp> }) {
    if (appTimes.length === 0) {
        return <Typography variant="body2" color="text.secondary">No app time recorded in this window yet.</Typography>;
    }
    const longest = appTimes[0].ms;
    const shown = appTimes.slice(0, SHOWN_APPS);
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
                </Stack>
            ))}
            {restMs > 0 && (
                <Typography variant="caption" color="text.secondary">
                    {appTimes.length - SHOWN_APPS} more {appTimes.length - SHOWN_APPS === 1 ? 'app' : 'apps'} · {formatScreenDuration(restMs)}
                </Typography>
            )}
        </Stack>
    );
}
