import { memo, useEffect, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Slider,
    Stack,
    Typography,
    alpha,
} from '@mui/material';
import { MentalThreadSummary } from '../../types/MentalThread.ts';
import { attentionStateDetails, attentionStates } from './mentalThreadPresentation.ts';

interface MentalLoadOverviewProps {
    summary: MentalThreadSummary;
    onCapacitySave: (capacity: number) => Promise<boolean>;
}

export const MentalLoadOverview = memo(function MentalLoadOverview({ summary, onCapacitySave }: MentalLoadOverviewProps) {
    const [capacity, setCapacity] = useState(summary.capacityToday ?? 5);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setCapacity(summary.capacityToday ?? 5);
    }, [summary.capacityToday]);

    const saveCapacity = async () => {
        setSaving(true);
        try {
            await onCapacitySave(capacity);
        } finally {
            setSaving(false);
        }
    };

    const stateCounts = {
        ACTING: summary.actingCount,
        RUMINATING: summary.ruminatingCount,
        PLANNED: summary.plannedCount,
        PENDING: summary.pendingCount,
    };

    return (
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                spacing={2}
            >
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                    <Box sx={{ minWidth: 120, textAlign: 'left' }}>
                        <Typography variant="caption" color="text.secondary">Open mental load</Typography>
                        <Stack direction="row" alignItems="baseline" spacing={0.75}>
                            <Typography variant="h5" fontWeight={750}>{summary.totalLoad}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {summary.openThreadCount} open · {summary.highLoadCount} high-load
                            </Typography>
                        </Stack>
                    </Box>
                    <Stack direction="row" gap={0.75} flexWrap="wrap">
                        {attentionStates.map(state => (
                            <Chip
                                key={state}
                                size="small"
                                label={`${attentionStateDetails[state].label} ${stateCounts[state]}`}
                                sx={{
                                    color: attentionStateDetails[state].color,
                                    bgcolor: alpha(attentionStateDetails[state].color, 0.1),
                                    fontWeight: 650,
                                }}
                            />
                        ))}
                    </Stack>
                </Stack>

                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{ minWidth: { md: 330 }, maxWidth: { md: 390 } }}
                >
                    <Box sx={{ minWidth: 78, textAlign: 'left' }}>
                        <Typography variant="caption" color="text.secondary" display="block">Today’s capacity</Typography>
                        <Typography variant="subtitle1" fontWeight={750} lineHeight={1.2}>
                            {capacity}<Typography component="span" variant="caption" color="text.secondary">/10</Typography>
                        </Typography>
                    </Box>
                    <Slider
                        value={capacity}
                        onChange={(_, value) => setCapacity(value as number)}
                        min={1}
                        max={10}
                        step={1}
                        valueLabelDisplay="auto"
                        aria-label="Capacity today"
                        sx={{ flex: 1, minWidth: 100 }}
                    />
                    <Button
                        size="small"
                        variant={summary.capacityToday === capacity ? 'text' : 'contained'}
                        disabled={saving || summary.capacityToday === capacity}
                        onClick={() => void saveCapacity()}
                        sx={{ flexShrink: 0 }}
                    >
                        {saving ? 'Saving…' : summary.capacityToday === null ? 'Save' : 'Update'}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
});
