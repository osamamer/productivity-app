import { Box, Typography } from '@mui/material';
import { PlannedBlock, ScreenBlock } from './dayTimelineLayout';
import { formatScreenDuration, formatTimeRange } from './screenTimeText';

// Shared tooltips of timeline blocks, so the Day page strip and the calendar's day view read alike.

export function TooltipBody({ title, lines }: { title: string; lines: string[] }) {
    return (
        <Box sx={{ py: 0.25 }}>
            <Typography variant="body2" fontWeight={700}>{title}</Typography>
            {lines.map(line => <Typography key={line} variant="caption" component="div">{line}</Typography>)}
        </Box>
    );
}

export function ScreenTooltip({ block }: { block: ScreenBlock }) {
    const when = `${formatTimeRange(block.start, block.end)} · ${formatScreenDuration(block.end - block.start)}`;
    if (block.kind === 'app') return <TooltipBody title={block.name} lines={[when, ...block.titles]} />;
    if (block.kind === 'switching') {
        return <TooltipBody title="Switching between apps" lines={[when, ...block.apps.slice(0, 4).map(app => `${app.name} · ${formatScreenDuration(app.ms)}`)]} />;
    }
    if (block.kind === 'away') return <TooltipBody title="Away from the screen" lines={[when, 'Idle, locked or asleep']} />;
    return <TooltipBody title="Not tracked" lines={[when, 'Claritard was closed or screen time was off']} />;
}

export function PlannedTooltip({ block }: { block: PlannedBlock }) {
    return <TooltipBody title={block.title} lines={[block.activityName ?? (block.kind === 'focus' ? 'Focus session' : 'Calendar event'), formatTimeRange(block.start, block.end)]} />;
}
