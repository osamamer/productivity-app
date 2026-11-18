import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { formatScreenDuration } from '../day/screenTimeText';
import { ComparisonBucket } from './planVsTimed';
import { bucketLabel, bucketTitle } from './screenTimeReport';

const CHART_HEIGHT = 160;
const MAX_X_LABELS = 12;

function Legend({ swatch, label }: { swatch: object; label: string }) {
    return (
        <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 14, height: 10, borderRadius: '2px', ...swatch }} />
            <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Stack>
    );
}

/** Planned (outlined) beside timed (solid) for each day, week or month. No target line. */
export function ComparisonBars({ buckets }: { buckets: ComparisonBucket[] }) {
    const theme = useTheme();
    const color = theme.palette.primary.main;
    const longest = Math.max(0, ...buckets.flatMap(bucket => [bucket.plannedMs, bucket.timedMs]));
    const labelEvery = Math.max(1, Math.ceil(buckets.length / MAX_X_LABELS));
    const height = (ms: number) => (longest > 0 ? `${(ms / longest) * 100}%` : 0);
    const planned = { border: `1.5px solid ${color}`, bgcolor: alpha(color, 0.12) };
    const timed = { bgcolor: color };

    return (
        <Box>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Legend swatch={planned} label="Planned" />
                <Legend swatch={timed} label="Timed" />
            </Stack>
            <Stack direction="row" alignItems="flex-end" sx={{ height: CHART_HEIGHT, borderBottom: 1, borderColor: 'divider' }}>
                {buckets.map(bucket => (
                    <Tooltip key={bucket.start.getTime()} arrow title={(
                        <Box sx={{ py: 0.25 }}>
                            <Typography variant="body2" fontWeight={700}>{bucketTitle(bucket)}</Typography>
                            <Typography variant="caption" component="div">Planned {formatScreenDuration(bucket.plannedMs)}</Typography>
                            <Typography variant="caption" component="div">Timed {formatScreenDuration(bucket.timedMs)}</Typography>
                        </Box>
                    )}>
                        <Stack direction="row" alignItems="flex-end" justifyContent="center" spacing="2px" sx={{ flex: 1, height: '100%', px: '2px' }}>
                            <Box sx={{ flex: 1, maxWidth: 18, height: height(bucket.plannedMs), minHeight: bucket.plannedMs ? 2 : 0, borderRadius: '4px 4px 0 0', ...planned }} />
                            <Box sx={{ flex: 1, maxWidth: 18, height: height(bucket.timedMs), minHeight: bucket.timedMs ? 2 : 0, borderRadius: '4px 4px 0 0', ...timed }} />
                        </Stack>
                    </Tooltip>
                ))}
            </Stack>
            <Stack direction="row" sx={{ mt: 0.5 }}>
                {buckets.map((bucket, index) => (
                    <Typography key={bucket.start.getTime()} variant="caption" color="text.secondary" noWrap sx={{ flex: 1, textAlign: 'center', minWidth: 0, overflow: 'visible' }}>
                        {index % labelEvery === 0 ? bucketLabel(bucket) : ''}
                    </Typography>
                ))}
            </Stack>
        </Box>
    );
}
