import { Box } from '@mui/material';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import { useEffect, useState } from 'react';

export function OfflineStatusBar() {
    const [offline, setOffline] = useState(() => !navigator.onLine);

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

    if (!offline) return null;

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
            <span>No internet connection</span>
        </Box>
    );
}
