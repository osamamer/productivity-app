import React from 'react';
import { Box, Grid } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper';
import { GrafanaPanel } from "../components/box/GrafanaPanel.tsx";

export function StatsPage() {
    return (
        <PageWrapper>
            <Box sx={{
                display: 'flex',
                gap: 3,
                height: '100%',
                flexWrap: 'wrap',
                marginLeft: 4,
                marginRight: 4,
            }}>
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <GrafanaPanel
                            title="Day Ratings"
                            description="Your daily ratings over time"
                            computerId=""
                            metric=""
                            panelId="1"
                            unit=""
                            defaultTimeRange="30d"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <GrafanaPanel
                            title="Completed Tasks"
                            description="Tasks completed per day"
                            computerId=""
                            metric=""
                            panelId="2"
                            unit=""
                            defaultTimeRange="30d"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <GrafanaPanel
                            title="Task Creation Trend"
                            description="New tasks created over time"
                            computerId=""
                            metric=""
                            panelId="3"
                            unit=""
                            defaultTimeRange="7d"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <GrafanaPanel
                            title="Yearly Overview"
                            description="Long-term productivity trends"
                            computerId=""
                            metric=""
                            panelId="4"
                            unit=""
                            defaultTimeRange="1y"
                        />
                    </Grid>
                </Grid>
            </Box>
        </PageWrapper>
    );
}

export default StatsPage;