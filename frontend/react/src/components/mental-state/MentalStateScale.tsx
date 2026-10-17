import { Box, Chip, Slider, Stack, Typography } from '@mui/material';

interface MentalStateScaleProps {
    label: string;
    description: string;
    lowLabel: string;
    highLabel: string;
    value: number;
    onChange: (value: number) => void;
}

export function MentalStateScale({
    label,
    description,
    lowLabel,
    highLabel,
    value,
    onChange,
}: MentalStateScaleProps) {
    return (
        <Box sx={{ textAlign: 'left' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Box>
                    <Typography fontWeight={600}>{label}</Typography>
                    <Typography variant="body2" color="text.secondary">{description}</Typography>
                </Box>
                <Chip label={`${value}/10`} size="small" color="primary" sx={{ minWidth: 56, fontWeight: 700 }} />
            </Stack>
            <Slider
                value={value}
                min={1}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
                aria-label={label}
                onChange={(_, nextValue) => onChange(nextValue as number)}
                sx={{ mt: 1, mb: 0 }}
            />
            <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">1 · {lowLabel}</Typography>
                <Typography variant="caption" color="text.secondary">{highLabel} · 10</Typography>
            </Stack>
        </Box>
    );
}
