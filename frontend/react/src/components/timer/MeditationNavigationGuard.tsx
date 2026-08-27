import { useEffect, useState } from 'react';
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import { useBlocker } from 'react-router-dom';
import { meditationService } from '../../services/api/meditationService.ts';
import { MeditationSession } from '../../types/MeditationSession.ts';

interface MeditationNavigationGuardProps {
    session: MeditationSession | null;
    onSessionEnded: () => void;
    onError: (message: string) => void;
}

export function MeditationNavigationGuard({
    session,
    onSessionEnded,
    onError,
}: MeditationNavigationGuardProps) {
    const blocker = useBlocker(Boolean(session));
    const [isEnding, setIsEnding] = useState(false);

    useEffect(() => {
        if (!session) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        const handlePageHide = () => {
            meditationService.endSessionOnUnload(session.id);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [session]);

    const stayOnPage = () => {
        if (blocker.state === 'blocked') blocker.reset();
    };

    const endSessionAndLeave = async () => {
        if (!session || blocker.state !== 'blocked') return;

        setIsEnding(true);
        onError('');
        try {
            await meditationService.endSession(session.id);
            onSessionEnded();
            blocker.proceed();
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Could not finish meditation.');
            setIsEnding(false);
        }
    };

    return (
        <Dialog open={blocker.state === 'blocked'} onClose={() => !isEnding && stayOnPage()} fullWidth maxWidth="xs">
            <DialogTitle>End meditation and leave?</DialogTitle>
            <DialogContent>
                <Typography color="text.secondary">
                    Your meditation session is still active. Leaving will end and save the session.
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={stayOnPage} disabled={isEnding}>Keep meditating</Button>
                <Button variant="contained" color="error" onClick={endSessionAndLeave} disabled={isEnding}>
                    {isEnding ? <CircularProgress size={18} color="inherit" /> : 'End session and leave'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
