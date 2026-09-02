import { IconButton } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate } from 'react-router-dom';

export function BackToMentalButton() {
    const navigate = useNavigate();

    return (
        <IconButton
            onClick={() => navigate('/mental')}
            title="Back to mental"
            aria-label="Back to mental"
            size="small"
            sx={{
                alignSelf: 'flex-start',
                ml: -1,
                mb: 1,
                color: 'text.secondary',
                '&:hover': {
                    color: 'primary.main',
                    backgroundColor: 'action.hover',
                },
            }}
        >
            <ArrowBackRoundedIcon />
        </IconButton>
    );
}
