import { useMemo } from 'react';
import { Alert, Box, Card, Divider, Skeleton, Stack, Typography } from '@mui/material';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import { DayOverview } from '../../types/DayOverview';
import { buildPlannedLane, buildScreenLane } from './dayTimelineLayout';
import { plannedItems } from './plannedItems';
import { formatScreenDuration } from './screenTimeText';
import { useScreenTime } from './useScreenTime';
import { useActivities } from '../../hooks/useActivities';
import { DayTimeline } from './DayTimeline';
import { ScreenTimeSummary } from './ScreenTimeSummary';
import { ScreenTimeSetup } from './ScreenTimeSetup';

interface ScreenTimeCardProps {
    overview: DayOverview;
    windowStart: Date;
    windowEnd: Date;
}

/** Plan vs. screen for one day, in the desktop app only. */
export function ScreenTimeCard({ overview, windowStart, windowEnd }: ScreenTimeCardProps) {
    const start = windowStart.getTime();
    const end = windowEnd.getTime();
    const { available, status, range, error, saveSettings } = useScreenTime({ start, end });
    const activities = useActivities();

    const layout = useMemo(() => {
        // `range` changes every refresh, which is when "now" should move too.
        const now = Date.now();
        const apps = range?.apps ?? {};
        return {
            now,
            planned: buildPlannedLane(plannedItems(overview, new Date(start), new Date(end), now, activities ?? []), start, end),
            screen: buildScreenLane({ segments: range?.segments ?? [], tracked: range?.tracked ?? [], nameOf: appId => apps[appId]?.name ?? appId }, start, end, now),
        };
    }, [overview, range, start, end, activities]);

    if (!available) return null;
    const enabled = status?.settings.enabled ?? false;

    return (
        <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <MonitorHeartOutlinedIcon color="primary" />
                <Box sx={{ flex: 1, textAlign: 'left' }}>
                    <Typography variant="h6" fontWeight={700}>Plan and screen</Typography>
                    {enabled && status?.supported && (
                        <Typography variant="caption" color="text.secondary">
                            {formatScreenDuration(layout.screen.totalMs)} on screen in this window
                        </Typography>
                    )}
                </Box>
            </Stack>
            {error && <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert>}
            {!status ? (
                <Skeleton variant="rounded" height={120} />
            ) : !enabled ? (
                <ScreenTimeSetup settings={status.settings} onSave={saveSettings} />
            ) : !status.supported ? (
                <Alert severity="info">{status.reason ?? 'Screen time cannot run on this desktop.'}</Alert>
            ) : (
                <Stack spacing={2}>
                    <DayTimeline windowStart={start} windowEnd={end} now={layout.now} planned={layout.planned} screen={layout.screen.blocks} />
                    <Divider />
                    <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Where the day went</Typography>
                        <ScreenTimeSummary appTimes={layout.screen.appTimes} apps={range?.apps ?? {}} />
                    </Box>
                </Stack>
            )}
        </Card>
    );
}
