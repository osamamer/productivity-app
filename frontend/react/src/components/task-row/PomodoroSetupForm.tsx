import { Box, Button, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { PomodoroConfig, PomodoroFormValues } from '../../services/api/pomodoroConfigService';
import { PomodoroNumberField } from '../timer/PomodoroNumberField';

type PomodoroField = 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'numFocuses';

type PomodoroSetupFormProps = {
    form: PomodoroFormValues;
    durationUnit: PomodoroConfig['durationUnit'];
    fieldMax: Readonly<Record<PomodoroField, number>>;
    canStart: boolean;
    onChange: (updates: Partial<PomodoroFormValues>) => void;
    onStart: () => void;
};

/** Durations and session count for a new Pomodoro on a task row. */
export function PomodoroSetupForm({ form, durationUnit, fieldMax, canStart, onChange, onStart }: PomodoroSetupFormProps) {
    const activeAccent = useTheme().palette.primary.main;
    return (
        <Box component="form" onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            onStart();
        }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
                {(
                    [
                        { key: 'focusDuration',      label: `Focus (${durationUnit})`       },
                        { key: 'shortBreakDuration', label: `Short break (${durationUnit})` },
                        { key: 'longBreakDuration',  label: `Long break (${durationUnit})`  },
                        { key: 'numFocuses',         label: 'Sessions'          },
                    ] as const
                ).map(({ key, label }) => (
                    <PomodoroNumberField
                        key={key}
                        name={key}
                        label={label}
                        value={form[key]}
                        onChange={value => onChange({ [key]: value })}
                        max={fieldMax[key]}
                    />
                ))}
            </Box>
            <Button
                variant="outlined"
                size="small"
                fullWidth
                type="submit"
                disabled={!canStart}
                startIcon={<PlayArrowIcon />}
                sx={{
                    borderColor: 'primary',
                    color: 'primary',
                    '&:hover': {
                        borderColor: 'primary',
                        backgroundColor: alpha(activeAccent, 0.08),
                    },
                }}
            >
                Start
            </Button>
        </Box>
    );
}
