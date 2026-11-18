import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, LinearProgress, Snackbar, Typography } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { AppPausesSection } from '../components/boundaries/AppPausesSection';
import { SiteTimersSection } from '../components/boundaries/SiteTimersSection';
import { desktopTimeouts, type TimeoutState } from '../services/desktop';

const REFRESH_MS = 5000;

type Notice = { severity: 'success' | 'error'; message: string };

/** App pauses and Firefox site timers, a tab of Digital wellbeing. Only the Linux desktop app can enforce them. */
export function BoundariesPage() {
    const [state, setState] = useState<TimeoutState | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);

    const refresh = useCallback(async () => {
        if (!desktopTimeouts) return;
        try {
            setState(await desktopTimeouts.getState());
            setLoadError(null);
        } catch (error) {
            console.error('Could not load app timeouts:', error);
            setLoadError(error instanceof Error ? error.message : String(error));
        }
    }, []);

    useEffect(() => {
        void refresh();
        // Picks up apps installed meanwhile and the Firefox session countdown.
        const interval = window.setInterval(() => void refresh(), REFRESH_MS);
        return () => window.clearInterval(interval);
    }, [refresh]);

    const onChanged = useCallback((message: string) => {
        setNotice({ severity: 'success', message });
        void refresh();
    }, [refresh]);
    const onError = useCallback((message: string) => setNotice({ severity: 'error', message }), []);

    if (!desktopTimeouts) return <Navigate to="/wellbeing" replace />;

    return (
        <>
            <Typography color="text.secondary" sx={{ mb: { xs: 2, md: 3 }, maxWidth: 640, textAlign: 'left' }}>
                A moment to choose before the apps and sites that pull you in, and a gentle end once you're there.
            </Typography>

            {loadError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{loadError}</Alert>}
            {!state && !loadError && <LinearProgress aria-label="Loading boundaries" sx={{ borderRadius: 1 }} />}

            {state && (
                <Box sx={{ display: 'grid', gap: 3 }}>
                    <AppPausesSection apps={state.apps} timeouts={desktopTimeouts} onChanged={onChanged} onError={onError} />
                    <SiteTimersSection urls={state.urls} browser={state.browser} timeouts={desktopTimeouts} onChanged={onChanged} onError={onError} />
                </Box>
            )}

            <Snackbar
                open={notice !== null}
                autoHideDuration={notice?.severity === 'error' ? 8000 : 4000}
                onClose={() => setNotice(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {notice ? (
                    <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)} sx={{ borderRadius: 2 }}>
                        {notice.message}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </>
    );
}

export default BoundariesPage;
