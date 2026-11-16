import { isBackupFallbackNeeded, subscribeBackupAvailability } from '../services/backup/backupAvailability';
import { Box, Button } from '@mui/material';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { openBackup, readBackup } from '../services/backup/localBackup';

export function OfflineStatusBar() {
    const [offline, setOffline] = useState(() => !navigator.onLine);

    const serverUnavailable = useSyncExternalStore(subscribeBackupAvailability, isBackupFallbackNeeded);
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        if (offline || serverUnavailable) void readBackup().then(snapshot => setAvailable(Boolean(snapshot)))
            .catch(error => console.error('Could not check local backup:', error));
    }, [offline, serverUnavailable]);

    useEffect(() => {
        const handleOffline = () => setOffline(true);
        const handleOnline = () => setOffline(false);

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    if (!offline && !(serverUnavailable && available)) return null;

    return (
        <Box
            role="status"
            aria-live="polite"
            sx={{
                flex: '0 0 40px',
                minHeight: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                px: 2,
                py: 0.75,
                boxSizing: 'border-box',
                bgcolor: '#8F261F',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.22)',
            }}
        >
            <WifiOffRoundedIcon aria-hidden="true" sx={{ fontSize: 19 }} />
            <span>{offline ? 'No internet connection' : 'Your data could not be refreshed'}</span>
            {available && <Button color="inherit" onClick={() => {
                void openBackup().catch(error => console.error('Could not open local backup:', error));
            }}>View local backup</Button>}
        </Box>
    );
}
