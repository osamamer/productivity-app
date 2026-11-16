import { Box, Button, Typography } from '@mui/material';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import { desktopBridge } from '../../services/desktop';

function storageDescription(): string {
    if (desktopBridge?.mode === 'local') {
        return 'Your data is stored only on this computer. The app does not contact the cloud.';
    }
    return `Your data is stored in the cloud at ${desktopBridge?.cloudUrl ?? 'your server'}.`;
}

export default function DesktopStorageSection() {
    if (!desktopBridge) return null;

    return (
        <Box sx={{ mt: 3, pt: 3, borderTop: theme => `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <StorageOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Data storage
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                {storageDescription()} Local and cloud data are kept separately; switching does not copy anything.
            </Typography>
            <Button
                fullWidth
                variant="outlined"
                color="inherit"
                startIcon={<StorageOutlinedIcon />}
                onClick={() => desktopBridge?.openModeChooser()}
                sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1.1, textTransform: 'none' }}
            >
                Change storage mode
            </Button>
        </Box>
    );
}
