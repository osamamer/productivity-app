import { Box } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper.tsx';
import MeditationTimer from '../components/timer/MeditationTimer.tsx';

export function MeditationPage() {
    return (
        <PageWrapper>
            <Box sx={{ minHeight: '100%', width: '100%' }}>
                <MeditationTimer />
            </Box>
        </PageWrapper>
    );
}
