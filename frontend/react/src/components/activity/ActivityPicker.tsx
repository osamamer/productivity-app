import { Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Activity } from '../../types/Activity';
import { activityHex } from './activityColors';

interface ActivityPickerProps {
    activities: Activity[];
    value: string | null;
    onChange: (activityId: string | null) => void;
    label?: string;
}

/** Picks which activity a chunk of time is for; "None" keeps it an ordinary event. */
export function ActivityPicker({ activities, value, onChange, label = 'Activity' }: ActivityPickerProps) {
    if (activities.length === 0) return null;
    return (
        <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary" fontWeight={650}>{label}</Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap role="radiogroup" aria-label={label}>
                <Chip
                    label="None"
                    size="small"
                    role="radio"
                    aria-checked={value === null}
                    variant={value === null ? 'filled' : 'outlined'}
                    onClick={() => onChange(null)}
                />
                {activities.map(activity => {
                    const color = activityHex(activity.color, '#888');
                    const selected = value === activity.id;
                    return (
                        <Chip
                            key={activity.id}
                            label={activity.name}
                            size="small"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onChange(activity.id)}
                            sx={{
                                fontWeight: 650,
                                border: 1,
                                borderColor: color,
                                bgcolor: selected ? color : alpha(color, 0.12),
                                color: selected ? '#fff' : 'text.primary',
                                '&:hover': { bgcolor: selected ? color : alpha(color, 0.24) },
                            }}
                        />
                    );
                })}
            </Stack>
        </Stack>
    );
}
