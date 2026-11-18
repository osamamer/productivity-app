import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { formatScreenDuration } from '../day/screenTimeText';
import { bucketLabel, bucketTitle, type ReportBucket } from './screenTimeReport';

const CHART_HEIGHT = 180;
const MAX_X_LABELS = 12;

/** Screen time per bucket as plain bars in one hue: for noticing patterns, with no target line. */
export function ReportBars({ buckets }: { buckets: ReportBucket[] }) {
    const longest = Math.max(0, ...buckets.map(bucket => bucket.totalMs));
    const labelEvery = Math.max(1, Math.ceil(buckets.length / MAX_X_LABELS));

    return (
        <Box>
            <Stack direction="row" alignItems="flex-end" sx={{ position: 'relative', height: CHART_HEIGHT, borderBottom: 1, borderColor: 'divider' }}>
                {longest > 0 && (
                    <>
                        <Box sx={{ position: 'absolute', left: 0, right: 0, top: 0, borderTop: 1, borderColor: 'divider', borderStyle: 'dashed', pointerEvents: 'none' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', right: 0, top: -18 }}>
                            {formatScreenDuration(longest)}
                        </Typography>
                    </>
                )}
                {buckets.map(bucket => (
                    <Tooltip
                        key={bucket.start.getTime()}
                        arrow
                        title={(
                            <Box sx={{ py: 0.25 }}>
                                <Typography variant="body2" fontWeight={700}>{bucketTitle(bucket)}</Typography>
                                <Typography variant="caption">{bucket.totalMs > 0 ? formatScreenDuration(bucket.totalMs) : 'No screen time'}</Typography>
                            </Box>
                        )}
                    >
                        {/* The hover target is the full column, not just the bar. */}
                        <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', px: '1px', cursor: 'default', '&:hover > *': { opacity: 0.8 } }}>
                            <Box sx={{
                                width: '100%',
                                maxWidth: 40,
                                mx: 'auto',
                                height: longest > 0 ? `${(bucket.totalMs / longest) * 100}%` : 0,
                                minHeight: bucket.totalMs > 0 ? 2 : 0,
                                bgcolor: 'primary.main',
                                borderRadius: '4px 4px 0 0',
                            }} />
                        </Box>
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
