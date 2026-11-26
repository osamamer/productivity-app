import { Alert, Button, Snackbar } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { SlideFromRight } from './SlideFromRight';
import type { TaskFeedback } from './homeTypes';

type HomeTaskFeedbackSnackbarProps = {
    feedback: TaskFeedback | null;
    onUndo: () => void;
    onDismiss: () => void;
};

export function HomeTaskFeedbackSnackbar({ feedback, onUndo, onDismiss }: HomeTaskFeedbackSnackbarProps) {
    return (
        <Snackbar
            key={feedback?.id}
            open={feedback !== null}
            autoHideDuration={feedback?.undo ? 5000 : 2000}
            onClose={(_, reason) => {
                if (reason !== 'clickaway') onDismiss();
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            TransitionComponent={SlideFromRight}
            sx={{
                right: { xs: 12, sm: 28 },
                bottom: { xs: 12, sm: 28 },
            }}
        >
            {feedback ? (
                <Alert
                    severity={feedback.severity}
                    variant="outlined"
                    icon={<InfoOutlinedIcon fontSize="small" />}
                    action={feedback.undo ? (
                        <Button
                            size="small"
                            color="inherit"
                            startIcon={<ReplayIcon fontSize="small" />}
                            onClick={onUndo}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            Undo
                        </Button>
                    ) : undefined}
                    onClose={onDismiss}
                    sx={{
                        position: 'relative',
                        minWidth: 240,
                        maxWidth: 'calc(100vw - 48px)',
                        boxSizing: 'border-box',
                        alignItems: 'center',
                        backgroundColor: 'background.paper',
                        px: 1.5,
                        py: 0.5,
                        '& .MuiAlert-message': {
                            flex: '1 1 auto',
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'center',
                            py: 0.25,
                            fontSize: '0.85rem',
                        },
                        '& .MuiAlert-action': {
                            position: 'static',
                            flex: '0 0 auto',
                            alignSelf: 'center',
                            p: 0,
                            m: 0,
                            ml: 1,
                        },
                    }}
                >
                    {feedback.message}
                </Alert>
            ) : undefined}
        </Snackbar>
    );
}
