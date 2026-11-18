import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { UsageSettings } from '../../services/desktop';
import { ScreenTimeToggles } from './ScreenTimeToggles';

/**
 * Opt-in before anything is recorded: says exactly what is kept and where, so turning it on
 * is an informed choice rather than a surprise.
 */
export function ScreenTimeSetup({ settings, onSave }: { settings: UsageSettings; onSave: (settings: UsageSettings) => Promise<void> }) {
    const [draft, setDraft] = useState<UsageSettings>({ ...settings, startAtLogin: true });
    const [saving, setSaving] = useState(false);

    const turnOn = async () => {
        setSaving(true);
        await onSave({ ...draft, enabled: true });
        setSaving(false);
    };

    return (
        <Stack spacing={2} sx={{ textAlign: 'left' }}>
            <Box>
                <Typography variant="body2">
                    See your day the way it actually went: what was planned above, what was on your screen below.
                    It's here to make time visible, not to grade it.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Claritard records which app is in focus and, if you like, its window title. Time you're idle or locked
                    isn't counted. Everything stays in a folder on this computer and is never uploaded, even in cloud mode.
                </Typography>
            </Box>
            <ScreenTimeToggles settings={draft} onChange={setDraft} disabled={saving} />
            <Box>
                <Button variant="contained" onClick={() => void turnOn()} disabled={saving} sx={{ textTransform: 'none' }}>
                    Turn on screen time
                </Button>
            </Box>
        </Stack>
    );
}
