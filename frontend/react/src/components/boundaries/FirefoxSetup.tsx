import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import type { DesktopTimeouts, TimeoutState } from '../../services/desktop';

interface FirefoxSetupProps {
    browser: TimeoutState['browser'];
    timeouts: DesktopTimeouts;
    onChanged: (message: string) => void;
    onError: (message: string) => void;
}

/** The one-time steps that connect Firefox to Claritard: the native host and the extension. */
export function FirefoxSetup({ browser, timeouts, onChanged, onError }: FirefoxSetupProps) {
    const [busy, setBusy] = useState(false);

    const act = async (action: () => Promise<void>, done?: string) => {
        setBusy(true);
        try {
            await action();
            if (done) onChanged(done);
        } catch (error) {
            onError(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider', display: 'grid', gap: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Connect Firefox</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ flex: '1 1 280px' }}>
                    <strong>1.</strong> Let the Claritard URL Gate extension talk to this app.
                </Typography>
                {browser.hostInstalled ? (
                    <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircleRoundedIcon fontSize="small" /> Connected
                    </Typography>
                ) : (
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={busy}
                        startIcon={<ExtensionRoundedIcon />}
                        onClick={() => void act(() => timeouts.installBrowserHost(), 'Firefox can now reach Claritard.')}
                        sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                        Connect
                    </Button>
                )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ flex: '1 1 280px' }}>
                    <strong>2.</strong> Add the extension to Firefox: open <code>about:debugging</code> → This Firefox → Load Temporary Add-on, and pick <code>manifest.json</code> from the extension folder. Firefox forgets temporary add-ons on restart; a signed copy installs permanently.
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    disabled={busy}
                    startIcon={<FolderOpenRoundedIcon />}
                    onClick={() => void act(() => timeouts.openExtensionFolder())}
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                    Open extension folder
                </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
                Firefox's own website-blocking policies still take precedence. The extension tells this app which timed site you opened; nothing leaves your computer.
            </Typography>
        </Box>
    );
}
