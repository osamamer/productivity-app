import React from 'react';
import { Box, Stack, Skeleton } from '@mui/material';

export function StatsLoadingState() {
    return (
        <Box sx={{
            display: 'flex',
            flex: 1,
            gap: 2,
            overflow: 'hidden',
            minHeight: 0,
            flexDirection: { xs: 'column', md: 'row' },
        }}>
            <Box sx={{
                width: { xs: '100%', md: 360 },
                flexShrink: 0,
                overflow: 'hidden',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: { xs: 180, md: 0 },
                maxHeight: { xs: 270, md: 'none' },
            }}>
                {[0, 1].map(group => (
                    <Box key={group}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                            <Skeleton variant="rounded" width={28} height={28} />
                            <Skeleton variant="text" width={`${42 + group * 12}%`} />
                        </Stack>
                        {[0, 1].map(stat => (
                            <Stack key={stat} direction="row" alignItems="center" spacing={1} sx={{ pl: 3, mb: 1.25 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton variant="text" width={`${62 + stat * 13}%`} />
                                    <Skeleton variant="text" width={`${42 + stat * 9}%`} height={17} />
                                </Box>
                                <Skeleton variant="circular" width={24} height={24} />
                            </Stack>
                        ))}
                    </Box>
                ))}
            </Box>
            <Box sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
            }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Skeleton variant="circular" width={34} height={34} />
                    <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="30%" height={25} />
                        <Skeleton variant="text" width="48%" height={18} />
                    </Box>
                    <Skeleton variant="rounded" width={34} height={34} />
                </Stack>
                <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                        {[0, 1, 2].map(item => (
                            <Skeleton key={item} variant="rounded" height={58} sx={{ flex: 1 }} />
                        ))}
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
                        <Skeleton variant="rounded" width={190} height={34} />
                        <Skeleton variant="rounded" width={220} height={40} />
                    </Stack>
                    <Skeleton variant="rounded" height={200} />
                </Box>
            </Box>
        </Box>
    );
}
