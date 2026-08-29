import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import { MentalStateCheckIn } from '../../types/MentalState';

interface MentalStateResultProps {
    checkIn: MentalStateCheckIn | null;
    isCurrent?: boolean;
    embedded?: boolean;
    onRecheck?: () => void;
}

export function MentalStateResult({ checkIn, isCurrent = true, embedded = false, onRecheck }: MentalStateResultProps) {
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

    const content = (
        <>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                <Box>
                    <Typography variant="overline" color="text.secondary">
                        {isCurrent ? 'Your current state' : 'Past state'}
                    </Typography>
                    <Typography variant="h5" fontWeight={750}>{checkIn.state}</Typography>
                </Box>
                <Chip
                    label={new Date(checkIn.recordedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    variant="outlined"
                />
            </Stack>

            <Alert severity="info" icon={<TipsAndUpdatesOutlinedIcon />} sx={{ mt: 2.5, alignItems: 'flex-start', textAlign: 'left' }}>
                <Typography fontWeight={700} sx={{ mb: 0.75, textAlign: 'left' }}>
                    {isCurrent ? 'What may help now' : 'Recommendation for this check-in'}
                </Typography>
                <Stack spacing={1}>
                    {checkIn.suggestedActions.map(item => (
                        <Typography component="p" variant="body2" key={item} sx={{ m: 0, textAlign: 'left' }}>
                            {item}
                        </Typography>
                    ))}
                </Stack>
            </Alert>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.25 }}>
                Reflective guidance based on your check-in, not a diagnosis or emergency assessment.
            </Typography>
            {onRecheck && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button variant="outlined" onClick={onRecheck}>
                        Recheck my state
                    </Button>
                </Box>
            )}
        </>
    );

    if (embedded) {
        return <Box sx={{ p: { xs: 2, sm: 2.5 } }}>{content}</Box>;
    }

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: 'divider', borderRadius: 3, textAlign: 'left' }}>
            {content}
        </Paper>
    );
}
