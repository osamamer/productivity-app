import { useMemo } from 'react';
import { Alert, Box, Card, Skeleton, Stack, Typography } from '@mui/material';
import { desktopUsage, type UsageDailyTotals } from '../../services/desktop';
import { useRevalidatingResource } from '../../hooks/useRevalidatingResource';
import { screenTotalsResource, TOTALS_FRESH_MS } from '../../services/cache/screenTimeCache';
import { formatScreenDuration } from '../day/screenTimeText';
import { ScreenTimeSetup } from '../day/ScreenTimeSetup';
import { ScreenTimeSummary } from '../day/ScreenTimeSummary';
import { useActivities } from '../../hooks/useActivities';
import type { useScreenTime } from '../day/useScreenTime';
import { ReportBars } from './ReportBars';
import { StatTile } from './StatTile';
import { bucketDays, bucketUnit, reportAppTimes, reportSummary, reportWindow, type ReportPeriod } from './screenTimeReport';

const BARS_TITLE = { day: 'Screen time per day', week: 'Screen time per week', month: 'Screen time per month' } as const;

const noTotals = (): Promise<UsageDailyTotals> => Promise.reject(new Error('This desktop app cannot report screen time yet.'));

function useDailyTotals(period: ReportPeriod, enabled: boolean) {
    // Recomputed per render on purpose: the key only changes when the date does.
    const window = reportWindow(period, new Date());
    const from = window.from.getTime();
    const to = window.to.getTime();
    const getDailyTotals = desktopUsage?.getDailyTotals;
    const { data, previous, error } = useRevalidatingResource(
        screenTotalsResource,
        enabled && getDailyTotals ? `${from}:${to}` : null,
        getDailyTotals ? () => getDailyTotals(from, to) : noTotals,
        { freshMs: TOTALS_FRESH_MS, keepPrevious: true },
    );
    // Stable per key so the report below is not rebuilt every render.
    const stableWindow = useMemo(() => ({ from: new Date(from), to: new Date(to) }), [from, to]);
    return { window: stableWindow, totals: data, previous, error };
}

/** Screen time over the last week to year: totals, a bar per day/week/month and the apps it went to. */
export function ScreenTimeReport({ period, screen }: { period: ReportPeriod; screen: ReturnType<typeof useScreenTime> }) {
    const { status, error: statusError, saveSettings, assignActivity } = screen;
    const activities = useActivities();
    const enabled = Boolean(status?.settings.enabled);
    const { window, totals, previous, error } = useDailyTotals(period, enabled);

    const report = useMemo(() => {
        // While another period loads, its predecessor's days stay visible but faded, bucketed
        // for the new period so the bars do not jump twice.
        if (!totals) return null;
        const nameOf = (appId: string) => totals.apps[appId]?.name ?? appId;
        return {
            buckets: bucketDays(totals.days, period, window),
            summary: reportSummary(totals.days, window),
            appTimes: reportAppTimes(totals.days, window, nameOf),
        };
    }, [totals, period, window]);

    if (!desktopUsage?.getDailyTotals) {
        return <Alert severity="info">Update the desktop app to see screen time over longer periods.</Alert>;
    }
    if (!status) return <Skeleton variant="rounded" height={240} />;
    if (!enabled) {
        return (
            <Card variant="outlined" sx={{ p: 2 }}>
                <ScreenTimeSetup settings={status.settings} onSave={saveSettings} />
            </Card>
        );
    }

    return (
        <Stack spacing={2} sx={{ textAlign: 'left' }}>
            <Typography variant="h6" fontWeight={700}>Screen time</Typography>
            {(error || statusError) && <Alert severity="warning">{error ?? statusError}</Alert>}

            {!report ? (
                <Skeleton variant="rounded" height={320} />
            ) : (
                <Stack spacing={2} sx={{ opacity: previous ? 0.55 : 1, transition: 'opacity 160ms ease' }} aria-busy={previous}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <StatTile value={formatScreenDuration(report.summary.totalMs)} label="On screen in total" />
                        <StatTile value={report.summary.daysWithScreenTime ? formatScreenDuration(report.summary.averageMs) : '–'} label="A day, on days with screen time" />
                        <StatTile value={String(report.summary.daysWithScreenTime)} label="Days with screen time" />
                    </Stack>

                    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 3 }}>{BARS_TITLE[bucketUnit(period)]}</Typography>
                        <ReportBars buckets={report.buckets} />
                    </Card>

                    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Where the time went</Typography>
                        <Box><ScreenTimeSummary appTimes={report.appTimes} apps={totals?.apps ?? {}} activities={activities ?? []}
                            activityByApp={status.settings.activityByApp} assignActivity={assignActivity} /></Box>
                    </Card>
                </Stack>
            )}
        </Stack>
    );
}
