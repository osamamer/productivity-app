import { useState } from 'react';
import { Box, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import type { CountdownDisplay } from '../../services/desktop';
import { BoundarySectionHeader } from './BoundarySection';
import { sectionPaperSx } from './boundaryStyles';

interface CountdownDisplaySectionProps {
    display: CountdownDisplay;
    setDisplay: (display: CountdownDisplay) => Promise<void>;
    onChanged: (message: string) => void;
    onError: (message: string) => void;
}

/** Whether time left shows in a small window or as system notifications. Needs no password. */
export function CountdownDisplaySection({ display, setDisplay, onChanged, onError }: CountdownDisplaySectionProps) {
    const [busy, setBusy] = useState(false);

    const choose = async (next: CountdownDisplay | null) => {
        if (!next || next === display) return;
        setBusy(true);
        try {
            await setDisplay(next);
            onChanged(next === 'window' ? 'Time left now shows in a small window.' : 'Time left now shows as notifications.');
        } catch (error) {
            onError(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Paper elevation={0} sx={sectionPaperSx}>
            <BoundarySectionHeader
                Icon={TimerOutlinedIcon}
                title="Time left"
                description="How Claritard shows the time left before an app or Firefox closes."
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={display}
                    disabled={busy}
                    onChange={(_, next: CountdownDisplay | null) => void choose(next)}
                    aria-label="Show time left"
                >
                    <ToggleButton value="window" sx={{ textTransform: 'none', px: 2 }}>Small window</ToggleButton>
                    <ToggleButton value="notification" sx={{ textTransform: 'none', px: 2 }}>Notifications</ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary">
                    {display === 'window'
                        ? 'A small window stays on top and counts down.'
                        : 'One notification says when it closes, then reminders a minute and ten seconds before.'}
                </Typography>
            </Box>
        </Paper>
    );
}
