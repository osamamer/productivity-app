import { Box, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface StatEntryHeaderProps {
    title: string;
    date: string;
}

export function StatEntryHeader({ title, date }: StatEntryHeaderProps) {
    return (
        <Stack spacing={0.25} sx={{ width: '100%', textAlign: 'left' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ textAlign: 'left' }}>
                {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                {date}
            </Typography>
        </Stack>
    );
}

interface StatInputSectionProps {
    title: string;
    children: ReactNode;
}

export function StatInputSection({ title, children }: StatInputSectionProps) {
    return (
        <Stack spacing={0.75} alignItems="stretch" sx={{ width: '100%', textAlign: 'left' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ textAlign: 'left' }}>
                {title}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                {children}
            </Box>
        </Stack>
    );
}
