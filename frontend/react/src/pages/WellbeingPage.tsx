import type { ComponentType } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import { PageWrapper } from '../components/PageWrapper';
import { ScreenTimeReport } from '../components/wellbeing/ScreenTimeReport';
import { WellbeingToday } from '../components/wellbeing/WellbeingToday';
import { hasWellbeing, WELLBEING_TABS, type WellbeingTabId } from '../components/wellbeing/wellbeingTabs';
import { BoundariesPage } from './BoundariesPage';

const TAB_BODIES: Record<WellbeingTabId, ComponentType> = {
    today: WellbeingToday,
    report: ScreenTimeReport,
    boundaries: BoundariesPage,
};

/** Digital wellbeing: today's screen time, a report over longer periods, and boundaries. */
export function WellbeingPage() {
    const { pathname } = useLocation();
    const current = WELLBEING_TABS.find(tab => pathname === tab.path);

    if (!hasWellbeing) return <Navigate to="/" replace />;
    if (!current) return <Navigate to={WELLBEING_TABS[0].path} replace />;
    const Body = TAB_BODIES[current.id];

    return (
        <PageWrapper>
            <Box sx={{ width: '100%', maxWidth: 1180, mx: 'auto', py: { xs: 3, md: 5 }, textAlign: 'left' }}>
                <Typography variant="h4" fontWeight={750} sx={{ letterSpacing: '-0.03em' }}>
                    Digital wellbeing
                </Typography>
                <Tabs value={current.path} sx={{ mt: 1.5, mb: { xs: 2, md: 3 }, borderBottom: 1, borderColor: 'divider' }} aria-label="Digital wellbeing sections">
                    {WELLBEING_TABS.map(tab => (
                        <Tab key={tab.path} value={tab.path} label={tab.label} component={RouterLink} to={tab.path} replace sx={{ fontWeight: 650 }} />
                    ))}
                </Tabs>
                <Body />
            </Box>
        </PageWrapper>
    );
}

export default WellbeingPage;
