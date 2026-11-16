import { alpha, Box, Typography, type Theme } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

interface BoundarySectionHeaderProps {
    Icon: SvgIconComponent;
    title: string;
    description: string;
}

export function BoundarySectionHeader({ Icon, title, description }: BoundarySectionHeaderProps) {
    return (
        <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start', mb: 2.5 }}>
            <Box
                sx={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '14px',
                    color: 'primary.main',
                    bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.14),
                }}
            >
                <Icon sx={{ fontSize: 24 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.01em' }}>{title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.55 }}>{description}</Typography>
            </Box>
        </Box>
    );
}
