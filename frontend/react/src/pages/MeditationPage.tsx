import { useState } from 'react';
import { Box, Paper } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper.tsx';
import MeditationTimer from '../components/timer/MeditationTimer.tsx';
import { MeditationStats } from '../components/timer/MeditationStats.tsx';

export function MeditationPage() {
    const [statsRefreshKey, setStatsRefreshKey] = useState(0);

    return (
        <PageWrapper>
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 1400,
                    mx: 'auto',
                    my: 'auto',
                    borderRadius: 4,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    border: theme => `1px solid ${theme.palette.divider}`,
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        md: 'minmax(0, 3fr) minmax(380px, 2fr)',
                    },
                    alignItems: 'stretch',
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <MeditationTimer onSessionCompleted={() => setStatsRefreshKey(key => key + 1)} />
                </Box>
                <Box
                    sx={{
                        minWidth: 0,
                        borderTop: theme => ({ xs: `1px solid ${theme.palette.divider}`, md: 0 }),
                        borderLeft: theme => ({ xs: 0, md: `1px solid ${theme.palette.divider}` }),
                    }}
                >
                    <MeditationStats refreshKey={statsRefreshKey} />
                </Box>
            </Paper>
        </PageWrapper>
    );
}
