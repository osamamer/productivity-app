import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import { useNavigate } from 'react-router-dom';
import { MentalStateCheckIn } from '../../types/MentalState';

interface MentalStateResultProps {
    checkIn: MentalStateCheckIn | null;
    isCurrent?: boolean;
    isMostRecent: boolean;
    embedded?: boolean;
    onRecheck?: () => void;
    onGoToMostRecent: () => void;
}

export function MentalStateResult({
    checkIn,
    isCurrent = true,
    isMostRecent,
    embedded = false,
    onRecheck,
    onGoToMostRecent,
}: MentalStateResultProps) {
    const navigate = useNavigate();

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

    const readyForHome = checkIn.state === 'Ready' || checkIn.state === 'Almost Ready';

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
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="flex-end"
                spacing={1}
                sx={{ mt: 2 }}
            >
                {isMostRecent ? (
                    <>
                        <Button
                            variant={readyForHome ? 'contained' : 'outlined'}
                            startIcon={readyForHome ? <HomeOutlinedIcon /> : <SelfImprovementOutlinedIcon />}
                            onClick={() => navigate(readyForHome ? '/' : '/meditation')}
                        >
                            {readyForHome ? 'Go to home' : 'Go to meditation'}
                        </Button>
                        {onRecheck && (
                            <Button variant="outlined" onClick={onRecheck}>
                                Recheck my state
                            </Button>
                        )}
                    </>
                ) : (
                    <Button variant="outlined" startIcon={<HistoryRoundedIcon />} onClick={onGoToMostRecent}>
                        Go to most recent
                    </Button>
                )}
            </Stack>
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
