import { Card, Typography } from '@mui/material';

/** One headline number for the report. */
export function StatTile({ value, label }: { value: string; label: string }) {
    return (
        <Card variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'left' }}>
            <Typography variant="h5" fontWeight={700}>{value}</Typography>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Card>
    );
}
