import { Box } from '@mui/material';
import { keyframes } from '@mui/system';
import { Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../hooks/useUser';

const pageEnter = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 12px, 0);
    }
    to {
        opacity: 1;
        transform: none;
    }
`;

/** Replays the page entrance for a new route and once auth loading resolves. */
export function PageTransition() {
    const location = useLocation();
    const { loading } = useUser();

    return (
        <Box
            key={`${location.pathname}-${loading ? 'loading' : 'ready'}`}
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                animation: `${pageEnter} 360ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                },
            }}
        >
            <Outlet />
        </Box>
    );
}
