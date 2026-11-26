import { Box, Button, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { formatFocusDuration } from './taskRowHelpers';

type PomodoroCompleteSummaryProps = {
    totalFocusSeconds: number;
    completedFocusSessions: number;
    numFocuses: number;
    onDismiss: () => void;
};

/** What a task row's Pomodoro panel shows once every focus session is done. */
export function PomodoroCompleteSummary({
    totalFocusSeconds,
    completedFocusSessions,
    numFocuses,
    onDismiss,
}: PomodoroCompleteSummaryProps) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 52 }}>
            <CheckCircleOutlineIcon color="success" />
            <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Pomodoro complete</Typography>
                <Typography variant="body2" color="text.secondary">
                    {formatFocusDuration(totalFocusSeconds)} focused · {completedFocusSessions} of {numFocuses} sessions completed
                </Typography>
            </Box>
            <Button
                size="small"
                variant="outlined"
                onClick={event => {
                    event.stopPropagation();
                    onDismiss();
                }}
            >
                Dismiss
            </Button>
        </Box>
    );
}
