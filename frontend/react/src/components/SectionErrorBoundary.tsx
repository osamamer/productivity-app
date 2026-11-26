import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';

type Props = {
    /** What the section shows, for the message and the log, e.g. "Today's events". */
    label: string;
    children: ReactNode;
};

type State = {
    failed: boolean;
};

/**
 * Keeps one broken section, such as a record the UI cannot read, from blanking the whole page.
 * "Try again" renders the section afresh.
 */
export class SectionErrorBoundary extends Component<Props, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`Could not render ${this.props.label}: ${error.message}`, error, info);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, color: 'text.secondary' }}>
                <Typography variant="body2">{this.props.label} could not be shown.</Typography>
                <Button size="small" onClick={() => this.setState({ failed: false })}>Try again</Button>
            </Box>
        );
    }
}
