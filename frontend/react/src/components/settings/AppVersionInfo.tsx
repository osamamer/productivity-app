import { Typography } from '@mui/material';
import { desktopBridge } from '../../services/desktop';

export default function AppVersionInfo() {
    const desktopVersion = desktopBridge?.version;
    return (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            Claritard {__APP_VERSION__}
            {desktopVersion && ` · Desktop app ${desktopVersion}`}
        </Typography>
    );
}
