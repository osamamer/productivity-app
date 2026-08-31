import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { GENERIC_ERROR_MESSAGE } from '../services/utils/userMessages';

type Props = {
    children: ReactNode;
};

type State = {
    failed: boolean;
};

export function AppErrorPage() {
    return (
        <Box
            role="alert"
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                px: 3,
                textAlign: 'center',
                backgroundColor: 'background.default',
            }}
        >
            <Typography variant="h5">{GENERIC_ERROR_MESSAGE}</Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
                Try again
            </Button>
        </Box>
    );
}

export class AppErrorBoundary extends Component<Props, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unexpected application error', error, info);
    }

    render() {
        return this.state.failed ? <AppErrorPage /> : this.props.children;
    }
}
