import { useState } from 'react';
import { Divider, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { desktopUsage } from '../../services/desktop';
import { useScreenTime } from '../day/useScreenTime';
import { PlanVsTimedReport } from './PlanVsTimedReport';
import { ScreenTimeReport } from './ScreenTimeReport';
import { REPORT_PERIODS, type ReportPeriod } from './screenTimeReport';

/** The report tab: one period for planned-and-timed and, on the desktop, screen time. */
export function WellbeingReport() {
    const [period, setPeriod] = useState<ReportPeriod>('week');
    const screen = useScreenTime();
    const description = REPORT_PERIODS.find(option => option.value === period)?.description;

    return (
        <Stack spacing={3} sx={{ textAlign: 'left' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                <Typography color="text.secondary">The {description}, up to now</Typography>
                <ToggleButtonGroup size="small" exclusive value={period} onChange={(_, next: ReportPeriod | null) => next && setPeriod(next)} aria-label="Report period">
                    {REPORT_PERIODS.map(option => (
                        <ToggleButton key={option.value} value={option.value} aria-label={option.description} sx={{ px: 1.75, fontWeight: 700 }}>
                            {option.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Stack>
            <PlanVsTimedReport period={period} activityByApp={screen.status?.settings.activityByApp} />
            {desktopUsage && (
                <>
                    <Divider />
                    <ScreenTimeReport period={period} screen={screen} />
                </>
            )}
        </Stack>
    );
}
