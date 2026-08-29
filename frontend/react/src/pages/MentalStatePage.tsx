import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper';
import { MentalStateCheckInForm } from '../components/mental-state/MentalStateCheckInForm';
import { MentalStateHistory } from '../components/mental-state/MentalStateHistory';
import { MentalStateResult } from '../components/mental-state/MentalStateResult';
import { mentalStateService } from '../services/api/mentalStateService';
import { MentalStateCheckIn } from '../types/MentalState';

export function MentalStatePage() {
    const [history, setHistory] = useState<MentalStateCheckIn[]>([]);
    const [selected, setSelected] = useState<MentalStateCheckIn | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        mentalStateService.getHistory(40)
            .then(checkIns => {
                if (cancelled) return;
                setHistory(checkIns);
                setSelected(checkIns[0] ?? null);
            })
            .catch(requestError => {
                console.error('Failed to load mental state history:', requestError);
                if (!cancelled) setError('Could not load your previous mental state check-ins.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const handleSaved = (checkIn: MentalStateCheckIn) => {
        setHistory(current => [checkIn, ...current]);
        setSelected(checkIn);
        setError(null);
    };

    return (
        <PageWrapper>
            <Box sx={{ width: '100%', maxWidth: 1040, mx: 'auto', pb: 3, textAlign: 'left' }}>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h4" fontWeight={750} sx={{ letterSpacing: '-0.02em' }}>Mental state</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        A quick check-in for the state you are in right now.
                    </Typography>
                </Box>

                {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 250px' }, gap: 2, alignItems: 'start' }}>
                    <Stack spacing={2}>
                        <MentalStateCheckInForm onSaved={handleSaved} />
                        {loading ? (
                            <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}>
                                <CircularProgress size={30} />
                            </Box>
                        ) : (
                            <MentalStateResult checkIn={selected} />
                        )}
                    </Stack>
                    <MentalStateHistory checkIns={history} selectedId={selected?.id ?? null} onSelect={setSelected} />
                </Box>
            </Box>
        </PageWrapper>
    );
}

export default MentalStatePage;
