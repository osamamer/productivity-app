import { Box, Skeleton, Stack } from "@mui/material";
import React from "react";

import { calendarLoadingReveal } from './monthCalendarMotion';

export function CalendarLoadingState() {
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            gap: 1.5,
            animation: `${calendarLoadingReveal} 420ms cubic-bezier(0.22, 1, 0.36, 1) both`,
            '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
                '& .MuiSkeleton-root': { animation: 'none' },
            },
        }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1 }}>
                <Skeleton animation="wave" variant="rounded" width={32} height={32} />
                <Skeleton animation="wave" variant="rounded" width={32} height={32} />
                <Skeleton animation="wave" variant="rounded" width={72} height={36} />
                <Skeleton animation="wave" variant="text" width={190} height={36} />
            </Stack>
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gridTemplateRows: 'auto repeat(6, minmax(0, 1fr))',
                gap: '1px',
                flex: 1,
                minHeight: 0,
                p: '1px',
                bgcolor: 'divider',
            }}>
                {Array.from({ length: 49 }, (_, index) => (
                    <Box key={index} sx={{
                        bgcolor: 'background.paper',
                        p: 1,
                        animation: `${calendarLoadingReveal} 360ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(index, 8) * 25}ms both`,
                        '@media (prefers-reduced-motion: reduce)': {
                            animation: 'none',
                            '& .MuiSkeleton-root': { animation: 'none' },
                        },
                    }}>
                        {index < 7 ? (
                            <Skeleton animation="wave" variant="text" width="65%" height={20} />
                        ) : (
                            <Skeleton animation="wave" variant="text" width="18%" height={20} sx={{ ml: 'auto' }} />
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
