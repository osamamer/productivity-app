import { alpha, Box, Paper, Typography, useTheme } from '@mui/material';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import MoodRoundedIcon from '@mui/icons-material/MoodRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import SelfImprovementRoundedIcon from '@mui/icons-material/SelfImprovementRounded';
import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/PageWrapper';
import { getLastMentalDestination, rememberMentalDestination } from '../services/utils/mentalNavigation';

const mentalDestinations = [
    {
        title: 'Mental state',
        description: 'Check in with how you feel and get a little clarity for right now.',
        target: '/mental-state',
        Icon: MoodRoundedIcon,
    },
    {
        title: 'Mental threads',
        description: 'Untangle the thoughts and concerns that are taking up space.',
        target: '/mental-threads',
        Icon: PsychologyRoundedIcon,
    },
    {
        title: 'Meditation',
        description: 'Take a quiet pause with a guided focus session and gentle sounds.',
        target: '/meditation',
        Icon: SelfImprovementRoundedIcon,
    },
] as const;

export function MentalPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const theme = useTheme();
    const openedFromDestination = location.state?.skipLastMentalDestinationRedirect === true;
    const lastDestination = openedFromDestination ? null : getLastMentalDestination();
    const redirectDestination = !openedFromDestination
        && lastDestination !== null
        && lastDestination !== '/mental'
        ? lastDestination
        : null;

    useEffect(() => {
        if (redirectDestination === null) {
            rememberMentalDestination('/mental');
        }
    }, [redirectDestination]);

    if (redirectDestination) {
        return <Navigate to={redirectDestination} replace />;
    }

    const accentColors = [
        theme.palette.primary.main,
        theme.palette.info.main,
        theme.palette.secondary.main,
    ];

    return (
        <PageWrapper>
            <Box sx={{ width: '100%', maxWidth: 1080, mx: 'auto', py: { xs: 3, md: 7 }, textAlign: 'left' }}>
                <Box sx={{ maxWidth: 620, mb: { xs: 4, md: 6 } }}>
                    <Typography variant="h4" fontWeight={750} sx={{ letterSpacing: '-0.03em' }}>
                        Mental space
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1, fontSize: { sm: '1.05rem' } }}>
                        Three small ways to make a little more room in your head.
                    </Typography>
                </Box>

                <Box
                    component="nav"
                    aria-label="Mental tools"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                        gap: 2,
                    }}
                >
                    {mentalDestinations.map(({ title, description, target, Icon }, index) => {
                        const accent = accentColors[index];

                        return (
                            <Paper
                                key={target}
                                component="button"
                                type="button"
                                elevation={0}
                                onClick={() => {
                                    rememberMentalDestination(target);
                                    navigate(target);
                                }}
                                sx={{
                                    minHeight: { xs: 205, md: 250 },
                                    p: { xs: 2.5, sm: 3 },
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: 3,
                                    textAlign: 'left',
                                    color: 'text.primary',
                                    font: 'inherit',
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 3,
                                    background: `linear-gradient(155deg, ${alpha(accent, 0.11)} 0%, ${theme.palette.background.paper} 58%)`,
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        borderColor: accent,
                                        boxShadow: `0 12px 28px ${alpha(accent, 0.15)}`,
                                    },
                                    '&:focus-visible': {
                                        outline: `3px solid ${alpha(accent, 0.35)}`,
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                                    <Box
                                        sx={{
                                            width: 62,
                                            height: 62,
                                            display: 'grid',
                                            placeItems: 'center',
                                            flexShrink: 0,
                                            borderRadius: '20px',
                                            color: accent,
                                            backgroundColor: alpha(accent, 0.14),
                                        }}
                                    >
                                        <Icon sx={{ fontSize: 34 }} />
                                    </Box>
                                    <ArrowOutwardRoundedIcon sx={{ color: 'text.secondary', fontSize: 21 }} />
                                </Box>

                                <Box>
                                    <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.01em' }}>
                                        {title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.55 }}>
                                        {description}
                                    </Typography>
                                </Box>
                            </Paper>
                        );
                    })}
                </Box>
            </Box>
        </PageWrapper>
    );
}

export default MentalPage;
