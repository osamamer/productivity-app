import { CompactPopover } from '../CompactPopover';
import { useEffect, useRef, useState } from 'react';
import {
    Button, CircularProgress, DialogActions, DialogContent,
    DialogTitle, Typography,
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
    const [isCheckingSession, setIsCheckingSession] = useState(false);
    const blockerState = blocker.state;
    const blockerRef = useRef(blocker);
    const onSessionEndedRef = useRef(onSessionEnded);
    blockerRef.current = blocker;
    onSessionEndedRef.current = onSessionEnded;

    useEffect(() => {
        if (blockerState !== 'blocked') return;

        let cancelled = false;
        setIsCheckingSession(true);
        void meditationService.getActiveSession()
            .then(activeSession => {
                const currentBlocker = blockerRef.current;
                if (cancelled || currentBlocker.state !== 'blocked' || activeSession) return;
                onSessionEndedRef.current();
                currentBlocker.proceed();
            })
            .catch(error => {
                console.warn('Could not check the active meditation session before leaving:', error);
            })
            .finally(() => {
                if (!cancelled) setIsCheckingSession(false);
            });

        return () => {
            cancelled = true;
            setIsCheckingSession(false);
        };
    }, [blockerState]);

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
            const activeSession = await meditationService.getActiveSession();
            if (activeSession) await meditationService.endSession(activeSession.id);
            onSessionEnded();
            blocker.proceed();
        } catch (error) {
            try {
                const activeSession = await meditationService.getActiveSession();
                if (!activeSession) {
                    onSessionEnded();
                    blocker.proceed();
                    return;
                }
            } catch (refreshError) {
                console.warn('Could not recheck the meditation session after ending failed:', refreshError);
            }
            onError(error instanceof Error ? error.message : 'Could not finish meditation.');
        } finally {
            setIsEnding(false);
        }
    };

    return (
        <CompactPopover open={blocker.state === 'blocked'} onClose={() => !isEnding && stayOnPage()} fullWidth maxWidth="xs">
            <DialogTitle>End meditation and leave?</DialogTitle>
            <DialogContent>
                <Typography color="text.secondary">
                    Your meditation session is still active. Leaving will end and save the session.
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={stayOnPage} disabled={isEnding}>Keep meditating</Button>
                <Button variant="contained" color="error" onClick={endSessionAndLeave} disabled={isEnding || isCheckingSession}>
                    {isEnding || isCheckingSession ? <CircularProgress size={18} color="inherit" /> : 'End session and leave'}
                </Button>
            </DialogActions>
        </CompactPopover>
    );
}
