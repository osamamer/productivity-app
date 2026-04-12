import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import TodayIcon from '@mui/icons-material/Today';
import UpcomingIcon from '@mui/icons-material/EventAvailable';
import HistoryIcon from '@mui/icons-material/History';
import { SmartTaskInput } from '../input/SmartTaskInput.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';

type TaskPageComposerProps = {
    todayCount: number;
    upcomingCount: number;
    pastCount: number;
    expandedSections: {
        today: boolean;
        comingUp: boolean;
        leftovers: boolean;
    };
    onCreateTask: (task: TaskToCreate) => Promise<void>;
    onToggleSection: (section: 'today' | 'comingUp' | 'leftovers') => void;
};

export function TaskPageComposer({
    todayCount,
    upcomingCount,
    pastCount,
    expandedSections,
    onCreateTask,
    onToggleSection,
}: TaskPageComposerProps) {
    return (
        <Box sx={{ pb: 3 }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    mb: 3,
                }}
            >
                <Typography color="text.primary" variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                    Tasks
                </Typography>

                <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
                    <Chip
                        icon={<TodayIcon />}
                        label={`${todayCount} Today`}
                        color="primary"
                        variant={expandedSections.today ? 'filled' : 'outlined'}
                        onClick={() => onToggleSection('today')}
                        sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                        icon={<UpcomingIcon />}
                        label={`${upcomingCount} Upcoming`}
                        color="secondary"
                        variant={expandedSections.comingUp ? 'filled' : 'outlined'}
                        onClick={() => onToggleSection('comingUp')}
                        sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                        icon={<HistoryIcon />}
                        label={`${pastCount} Past`}
                        color="default"
                        variant={expandedSections.leftovers ? 'filled' : 'outlined'}
                        onClick={() => onToggleSection('leftovers')}
                        sx={{ cursor: 'pointer' }}
                    />
                </Stack>
            </Box>

            <Box
            >
                <Box
                    sx={{
                        width: { xs: '100%', md: '50%' },
                    }}
                >
                    <SmartTaskInput onSubmit={onCreateTask} />
                </Box>
            </Box>
        </Box>
    );
}
