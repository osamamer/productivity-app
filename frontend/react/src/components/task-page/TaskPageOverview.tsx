import React from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';

type TaskPageOverviewProps = {
    totalCount: number;
    completedCount: number;
    pendingCount: number;
    todayCount: number;
    upcomingCount: number;
    overdueCount: number;
    highPriorityCount: number;
};

export function TaskPageOverview({
    totalCount,
    completedCount,
    pendingCount,
    todayCount,
    upcomingCount,
    overdueCount,
    highPriorityCount,
}: TaskPageOverviewProps) {
    const completionRate = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return (
        <Box sx={{ pt: 3, borderTop: theme => `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
                Overview
            </Typography>
            <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                        Completion Rate
                    </Typography>
                    <Typography variant="h6" color="text.primary">
                        {completionRate}%
                    </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                        Today
                    </Typography>
                    <Typography variant="h6" color="text.primary">
                        {todayCount}
                    </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                        Coming Up
                    </Typography>
                    <Typography variant="h6" color="text.primary">
                        {upcomingCount}
                    </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                        Leftovers
                    </Typography>
                    <Typography variant="h6" color="warning.main">
                        {overdueCount}
                    </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                        High Priority Open
                    </Typography>
                    <Typography variant="h6" color="error.main">
                        {highPriorityCount}
                    </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                        Done / Open
                    </Typography>
                    <Typography variant="h6" color="text.primary">
                        {completedCount} / {pendingCount}
                    </Typography>
                </Box>
            </Stack>
        </Box>
    );
}
