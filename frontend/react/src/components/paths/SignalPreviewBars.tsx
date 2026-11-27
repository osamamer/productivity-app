import { Box, Typography } from '@mui/material';
import { format, parseISO } from 'date-fns';
import type { WeekStrength } from '../../types/Path';

/** How the signal would have scored recent weeks, drawn in the path's colour like the road. */
export function SignalPreviewBars({ weeks, color }: { weeks: WeekStrength[]; color: string }) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">Recent weeks with this signal</Typography>
            <Box role="list" aria-label="Recent weeks" sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, height: 56, mt: 0.5 }}>
                {weeks.map(week => {
                    const kept = Math.min(week.strength, 1.25);
                    const label = `Week of ${format(parseISO(`${week.weekStart}T12:00:00`), 'MMM d')}: ${Math.round(week.strength * 100)}%`;
                    return (
                        <Box key={week.weekStart} role="listitem" title={label} aria-label={label} sx={{
                            flex: 1, borderRadius: 1, background: color,
                            height: `${Math.max(6, (kept / 1.25) * 100)}%`,
                            opacity: week.strength <= 0 ? 0.15 : 0.3 + 0.7 * Math.min(week.strength, 1),
                        }} />
                    );
                })}
            </Box>
        </Box>
    );
}
