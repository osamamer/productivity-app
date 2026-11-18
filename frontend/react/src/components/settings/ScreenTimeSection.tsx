import { Alert, Box, Typography } from '@mui/material';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import { useScreenTime } from '../day/useScreenTime';
import { ScreenTimeToggles } from '../day/ScreenTimeToggles';

export default function ScreenTimeSection() {
    const { available, status, error, saveSettings } = useScreenTime();
    if (!available) return null;

    return (
        <Box sx={{ mt: 3, pt: 3, borderTop: theme => `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <MonitorHeartOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Screen time
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, textAlign: 'left' }}>
                Recorded and kept only on this computer. Shown on each day's page next to what you planned.
            </Typography>
            {error && <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert>}
            {status?.settings.enabled && !status.supported && status.reason && <Alert severity="info" sx={{ mb: 1.5 }}>{status.reason}</Alert>}
            {status && <ScreenTimeToggles settings={status.settings} onChange={settings => void saveSettings(settings)} showEnabled />}
        </Box>
    );
}
