import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { ChangeScope } from './whenModel';

/** For a repeating task: does a change apply to this occurrence or to all of them. */
export function ScopeChoice({ label, value, onChange }: {
    label: string;
    value: ChangeScope;
    onChange: (value: ChangeScope) => void;
}) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={value}
                onChange={(_event, next: ChangeScope | null) => { if (next) onChange(next); }}
                aria-label={label}
                sx={{ mt: 0.5, '& .MuiToggleButton-root': { textTransform: 'none', py: 0.5 } }}
            >
                <ToggleButton value="occurrence">This occurrence</ToggleButton>
                <ToggleButton value="all">All occurrences</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}
