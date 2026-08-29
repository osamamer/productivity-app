import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import { MentalStateCheckIn } from '../../types/MentalState';

interface MentalStateResultProps {
    checkIn: MentalStateCheckIn | null;
}

export function MentalStateResult({ checkIn }: MentalStateResultProps) {
    if (!checkIn) {
        return (
            <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: 'divider', borderRadius: 3, textAlign: 'left' }}>
                <Typography variant="h6" fontWeight={700}>Your snapshot will appear here</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Save a check-in to see your state and what may help next.
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: 'divider', borderRadius: 3, textAlign: 'left' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                <Box>
                    <Typography variant="overline" color="text.secondary">Your state</Typography>
                    <Typography variant="h5" fontWeight={750}>{checkIn.state}</Typography>
                </Box>
                <Chip
                    label={new Date(checkIn.recordedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    variant="outlined"
                />
            </Stack>

            <Alert severity="info" icon={<TipsAndUpdatesOutlinedIcon />} sx={{ mt: 2.5, alignItems: 'flex-start', textAlign: 'left' }}>
                <Typography fontWeight={700} sx={{ mb: 0.75, textAlign: 'left' }}>What may help now</Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75, textAlign: 'left' }}>
                    {checkIn.suggestedActions.map(item => (
                        <Typography component="li" variant="body2" key={item} sx={{ textAlign: 'left' }}>
                            {item}
                        </Typography>
                    ))}
                </Box>
            </Alert>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.25 }}>
                Reflective guidance based on your check-in, not a diagnosis or emergency assessment.
            </Typography>
        </Paper>
    );
}
