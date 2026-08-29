import { useEffect, useState } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper';
import { MentalStateCard } from '../components/mental-state/MentalStateCard';
import { MentalStateHistory } from '../components/mental-state/MentalStateHistory';
import { mentalStateService } from '../services/api/mentalStateService';
import { MentalStateCheckIn } from '../types/MentalState';

const CURRENT_STATE_WINDOW_MS = 60 * 60 * 1000;

function isCurrentCheckIn(checkIn: MentalStateCheckIn | null, now: number): boolean {
    if (!checkIn) return false;

    const recordedAt = Date.parse(checkIn.recordedAt);
    return Number.isFinite(recordedAt) && now - recordedAt <= CURRENT_STATE_WINDOW_MS;
}

export function MentalStatePage() {
    const [history, setHistory] = useState<MentalStateCheckIn[]>([]);
    const [selected, setSelected] = useState<MentalStateCheckIn | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        let cancelled = false;
        mentalStateService.getHistory(40)
            .then(checkIns => {
                if (cancelled) return;
                setHistory(checkIns);
                setSelected(null);
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
        setSelected(null);
        setError(null);
    };

    const latestCheckIn = history[0] ?? null;
    const currentCheckIn = isCurrentCheckIn(latestCheckIn, now) ? latestCheckIn : null;
    const displayedCheckIn = selected ?? currentCheckIn;

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
                        <MentalStateCard
                            loading={loading}
                            checkIn={displayedCheckIn}
                            isCurrent={displayedCheckIn !== null && displayedCheckIn.id === currentCheckIn?.id}
                            onSaved={handleSaved}
                        />
                    </Stack>
                    <MentalStateHistory
                        checkIns={history}
                        selectedId={selected?.id ?? currentCheckIn?.id ?? null}
                        onSelect={setSelected}
                    />
                </Box>
            </Box>
        </PageWrapper>
    );
}

export default MentalStatePage;
