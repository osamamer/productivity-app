import React from 'react';
import { alpha, Box, Chip, LinearProgress, Typography, useTheme } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { RatingDisplay } from './RatingDisplay';
import { useUser } from '../contexts/UserContext';
import { DayEntity } from '../types/DayEntity';
import { Task } from '../types/Task';

type HeroBannerProps = {
    todayTasks: Task[];
    pastTasks: Task[];
    today: DayEntity;
    onRatingSubmit: (rating: number) => void;
};

export function HeroBanner({ todayTasks, pastTasks, today, onRatingSubmit }: HeroBannerProps) {
    const { user } = useUser();
    const theme = useTheme();

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user?.firstName || user?.username || '';

    const formattedDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    const overdueCount = pastTasks.filter(t => !t.completed).length;
    const completedTodayCount = todayTasks.filter(t => t.completed).length;
    const remainingTodayCount = todayTasks.filter(t => !t.completed).length;
    const completionPct = todayTasks.length > 0
        ? Math.round((completedTodayCount / todayTasks.length) * 100)
        : 0;

    return (
        <Box
            sx={{
                px: 3,
                py: 2.5,
                boxShadow: 3,
                borderRadius: 2,
                backgroundColor: theme.palette.background.paper,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)} 0%, ${theme.palette.background.paper} 55%)`,
                transition: 'box-shadow 0.3s',
                '&:hover': { boxShadow: 6 },
            }}
        >
            {/* Top row */}
            <Box sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
            }}>
                {/* Left: greeting + date */}
                <Box>
                    <Typography
                        variant="h3"
                        sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.5px' }}
                    >
                        {greeting}{firstName ? `, ${firstName}` : ''}.
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
                        {formattedDate}
                    </Typography>
                </Box>

                {/* Right: stat chips + rating */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {remainingTodayCount > 0 && (
                            <Chip
                                icon={<AssignmentIcon />}
                                label={`${remainingTodayCount} left today`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        )}
                        {completedTodayCount > 0 && (
                            <Chip
                                icon={<CheckCircleIcon />}
                                label={`${completedTodayCount} done`}
                                size="small"
                                color="success"
                                variant="outlined"
                            />
                        )}
                        {overdueCount > 0 && (
                            <Chip
                                icon={<WarningAmberIcon />}
                                label={`${overdueCount} overdue`}
                                size="small"
                                color="warning"
                                variant="outlined"
                            />
                        )}
                    </Box>
                    <RatingDisplay rating={today.rating} onSubmit={onRatingSubmit} />
                </Box>
            </Box>

            {/* Bottom: progress bar — only when there are tasks today */}
            {todayTasks.length > 0 && (
                <Box sx={{ mt: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Today's progress
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {completedTodayCount} / {todayTasks.length} tasks
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={completionPct}
                        sx={{
                            height: 7,
                            borderRadius: 4,
                            backgroundColor: alpha(theme.palette.primary.main, 0.15),
                            '& .MuiLinearProgress-bar': { borderRadius: 4 },
                        }}
                    />
                </Box>
            )}
        </Box>
    );
}
