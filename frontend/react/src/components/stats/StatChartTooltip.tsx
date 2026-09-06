import { Box, Typography } from '@mui/material';
import { Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { TooltipContentProps } from 'recharts';

type ChartPayload = TooltipContentProps['payload'];

interface Props {
    active?: boolean;
    label?: ReactNode;
    labelFormatter?: TooltipContentProps['labelFormatter'];
    payload?: ChartPayload;
    theme: Theme;
    valueFormatter?: (value: number, name: string | number | undefined) => ReactNode | null;
}

export function StatChartTooltip({
    active,
    label,
    labelFormatter,
    payload,
    theme,
    valueFormatter,
}: Props) {
    if (!active || !payload?.length) return null;

    const visiblePayload = payload.filter(entry => entry.value !== undefined);
    if (visiblePayload.length === 0) return null;
    const displayLabel = labelFormatter ? labelFormatter(label, payload) : label;

    return (
        <Box
            role="status"
            sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                boxShadow: theme.shadows[4],
                color: 'text.primary',
                minWidth: 112,
                px: 1.25,
                py: 0.75,
            }}
        >
            {displayLabel !== undefined && displayLabel !== null && displayLabel !== '' && (
                <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'text.secondary', fontWeight: 650, mb: 0.35 }}
                >
                    {displayLabel}
                </Typography>
            )}
            {visiblePayload.map((entry, index) => {
                const value = entry.value;
                const formattedValue = typeof value === 'number'
                    ? valueFormatter?.(value, entry.name)
                    : value;

                return (
                    <Box
                        key={`${String(entry.dataKey ?? entry.name ?? 'value')}-${index}`}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 18 }}
                    >
                        <Box
                            aria-hidden="true"
                            sx={{
                                width: 7,
                                height: 7,
                                flexShrink: 0,
                                borderRadius: '50%',
                                bgcolor: entry.color ?? entry.stroke ?? theme.palette.primary.main,
                            }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
                            {entry.name ?? 'Value'}
                        </Typography>
                        {formattedValue !== null && formattedValue !== undefined && formattedValue !== '' && (
                            <Typography variant="caption" fontWeight={700}>
                                {formattedValue}
                            </Typography>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}
