import { Box, ButtonBase, Typography } from '@mui/material';
import { ActivityColor } from '../../types/Activity';
import { ACTIVITY_COLOR_ORDER, ACTIVITY_COLORS } from '../activity/activityColors';

/** An activity's details: its colour, which labels its chunks and timers everywhere. */
export function ActivityDetailsPanel({ color, onChange }: { color: ActivityColor; onChange: (color: ActivityColor) => void }) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, textAlign: 'left' }}>
                Colour
            </Typography>
            <Box role="radiogroup" aria-label="Colour" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {ACTIVITY_COLOR_ORDER.map(option => {
                    const selected = option === color;
                    return (
                        <ButtonBase
                            key={option}
                            role="radio"
                            aria-checked={selected}
                            aria-label={option}
                            onClick={() => onChange(option)}
                            sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                bgcolor: ACTIVITY_COLORS[option],
                                outline: selected ? '2px solid' : 'none',
                                outlineColor: 'text.primary',
                                outlineOffset: 2,
                            }}
                        />
                    );
                })}
            </Box>
        </Box>
    );
}
