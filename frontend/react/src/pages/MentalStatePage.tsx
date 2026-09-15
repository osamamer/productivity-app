import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from '@mui/material';
import { PageWrapper } from '../components/PageWrapper';
import { MentalStateCard } from '../components/mental-state/MentalStateCard';
import { MentalStateHistory } from '../components/mental-state/MentalStateHistory';
import { BackToMentalButton } from '../components/BackToMentalButton';
import { mentalStateService } from '../services/api/mentalStateService';
import { sideNavSnapshotCache } from '../services/cache/sideNavSnapshotCache';
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
    const [deleteTarget, setDeleteTarget] = useState<MentalStateCheckIn | null>(null);
    const [deleting, setDeleting] = useState(false);
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
        sideNavSnapshotCache.updateMentalState(checkIn.state);
    };

    async function handleDelete() {
        if (!deleteTarget || deleting) return;

        const target = deleteTarget;
        setDeleting(true);
        setError(null);
        try {
            await mentalStateService.deleteCheckIn(target.id);
            const remaining = history.filter(checkIn => checkIn.id !== target.id);
            setHistory(remaining);
            setSelected(current => current?.id === target.id ? null : current);
            if (history[0]?.id === target.id) {
                const next = remaining[0];
                sideNavSnapshotCache.updateMentalState(
                    next && isCurrentCheckIn(next, Date.now()) ? next.state : null,
                );
            }
            setDeleteTarget(null);
        } catch (requestError) {
            console.error('Failed to delete mental state check-in:', requestError);
            setError('Could not delete this check-in. Please try again.');
        } finally {
            setDeleting(false);
        }
    }

    const latestCheckIn = history[0] ?? null;
    const currentCheckIn = isCurrentCheckIn(latestCheckIn, now) ? latestCheckIn : null;
    const displayedCheckIn = selected ?? currentCheckIn;
    const displayedIsMostRecent = displayedCheckIn !== null && displayedCheckIn.id === latestCheckIn?.id;

    return (
        <PageWrapper>
            <Box sx={{ width: '100%', maxWidth: 1040, mx: 'auto', pb: 3, textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                <BackToMentalButton />
                <Box sx={{ width: '100%' }}>
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
                                isMostRecent={displayedIsMostRecent}
                                onSaved={handleSaved}
                                onGoToMostRecent={() => {
                                    if (latestCheckIn) setSelected(latestCheckIn);
                                }}
                            />
                        </Stack>
                        <MentalStateHistory
                            checkIns={history}
                            selectedId={selected?.id ?? currentCheckIn?.id ?? null}
                            onSelect={setSelected}
                            onDelete={setDeleteTarget}
                        />
                    </Box>
                </Box>
            </Box>
            <Dialog
                open={deleteTarget !== null}
                onClose={() => { if (!deleting) setDeleteTarget(null); }}
            >
                <DialogTitle>Delete this check-in?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently remove this mental-state check-in. This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
                    <Button color="error" onClick={() => { void handleDelete(); }} disabled={deleting}>
                        {deleting ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </PageWrapper>
    );
}

export default MentalStatePage;
