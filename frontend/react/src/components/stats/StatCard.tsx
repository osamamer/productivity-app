import React from 'react';
import {
    Card, CardContent, CardHeader, IconButton,
    ToggleButton, Stack, Tooltip,
} from '@mui/material';
import { useState } from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { StatDefinition } from '../../types/Stats';
import { StatLineChart } from './StatLineChart';
import { BooleanCalendarView } from './BooleanCalendarView';
import { StatSummaryBar } from './StatSummaryBar';

const CHART_DATE_RANGES = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '3m', value: 90 },
    { label: '1y', value: 365 },
];

const CALENDAR_DATE_RANGES = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
];

interface Props {
    definition: StatDefinition;
    onDelete: (id: string) => void;
    refreshKey: number;
}

export function StatCard({ definition, onDelete, refreshKey }: Props) {
    const [dateRange, setDateRange] = useState(30);

    return (
        <Card variant="outlined">
            <CardHeader
                title={definition.name}
                titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                subheader={definition.description}
                subheaderTypographyProps={{ variant: 'caption' }}
                action={
                    <Tooltip title="Delete stat and all its data">
                        <IconButton onClick={() => onDelete(definition.id)} size="small">
                            <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                }
                sx={{ pb: 0 }}
            />
            <CardContent>
                <StatSummaryBar definition={definition} refreshKey={refreshKey} />
                <Stack direction="row" spacing={0.5} sx={{ mb: 2 }}>
                    {(definition.type === 'BOOLEAN' ? CALENDAR_DATE_RANGES : CHART_DATE_RANGES).map(r => (
                        <ToggleButton
                            key={r.value}
                            value={r.value}
                            selected={dateRange === r.value}
                            onChange={() => setDateRange(r.value)}
                            size="small"
                            sx={{ px: 1.5, py: 0.25, fontSize: 12, lineHeight: 1.5 }}
                        >
                            {r.label}
                        </ToggleButton>
                    ))}
                </Stack>
                {definition.type === 'BOOLEAN' ? (
                    <BooleanCalendarView definition={definition} dateRange={dateRange} refreshKey={refreshKey} />
                ) : (
                    <StatLineChart definition={definition} dateRange={dateRange} refreshKey={refreshKey} />
                )}
            </CardContent>
        </Card>
    );
}
