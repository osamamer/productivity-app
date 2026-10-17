import { FormEvent, useState } from 'react';
import { Alert, Box, Button, CircularProgress, FormControl, FormControlLabel, FormLabel, Paper, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { MENTAL_STATE_GOAL_LABELS, MentalStateCheckIn, MentalStateCheckInRequest, MentalStateGoal } from '../../types/MentalState';
import { mentalStateService } from '../../services/api/mentalStateService';
import { MentalStateScale } from './MentalStateScale';

interface MentalStateCheckInFormProps {
    onSaved: (checkIn: MentalStateCheckIn) => void;
    embedded?: boolean;
}

const INITIAL_STATE: Omit<MentalStateCheckInRequest, 'goal'> = {
    energy: 5,
    activation: 5,
    stimulationHunger: 5,
    clarity: 5,
    valence: 5,
    emotionalLoad: 5,
};

const signalGroups = [
    {
        label: 'Energy & pace',
        signals: [
            { key: 'energy', label: 'Energy', description: 'Physical and mental energy available.', lowLabel: 'empty', highLabel: 'full' },
            { key: 'activation', label: 'Activation', description: 'How keyed up or activated your body feels.', lowLabel: 'still', highLabel: 'keyed up' },
        ],
    },
    {
        label: 'Attention',
        signals: [
            { key: 'stimulationHunger', label: 'Stimulation Hunger', description: 'How strongly you want more stimulation.', lowLabel: 'satisfied', highLabel: 'craving' },
            { key: 'clarity', label: 'Clarity', description: 'How clear and organized your mind feels.', lowLabel: 'foggy', highLabel: 'clear' },
        ],
    },
    {
        label: 'Emotions',
        signals: [
            { key: 'valence', label: 'Emotional tone', description: 'How pleasant or unpleasant this moment feels.', lowLabel: 'unpleasant', highLabel: 'pleasant' },
            { key: 'emotionalLoad', label: 'Emotional Load', description: 'How much emotional weight you are carrying.', lowLabel: 'light', highLabel: 'heavy' },
        ],
    },
] as const;

export function MentalStateCheckInForm({ onSaved, embedded = false }: MentalStateCheckInFormProps) {
    const [values, setValues] = useState<Omit<MentalStateCheckInRequest, 'goal'>>(INITIAL_STATE);
    const [goal, setGoal] = useState<MentalStateGoal | ''>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = (field: keyof typeof values, value: number) => {
        setValues(current => ({ ...current, [field]: value }));
    };

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!goal) return;
        setSaving(true);
        setError(null);
        try {
            onSaved(await mentalStateService.checkIn({ ...values, goal }));
        } catch (requestError) {
            console.error('Failed to record mental state check-in:', requestError);
            setError('Could not save this check-in. Your ratings are still here so you can try again.');
        } finally {
            setSaving(false);
        }
    }

    const content = (
        <>
            <Typography variant="h6" fontWeight={700}>How are you right now?</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.75 }}>
                Rate each signal from 1 to 10. Check in again whenever your state changes.
            </Typography>

            <FormControl component="fieldset" sx={{ mb: 1.75 }}>
                <FormLabel component="legend" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    What are we doing?
                </FormLabel>
                <RadioGroup
                    row
                    value={goal}
                    onChange={event => setGoal(event.target.value as MentalStateGoal)}
                    sx={{ mt: 0.25, gap: { xs: 0, sm: 1 } }}
                >
                    {(Object.entries(MENTAL_STATE_GOAL_LABELS) as [MentalStateGoal, string][]).map(([value, label]) => (
                        <FormControlLabel key={value} value={value} control={<Radio />} label={label} />
                    ))}
                </RadioGroup>
            </FormControl>

            <Stack spacing={1.5}>
                {signalGroups.map((group, index) => (
                    <Box
                        key={group.label}
                        sx={{
                            pt: index === 0 ? 0 : 1.25,
                            borderTop: index === 0 ? 0 : 1,
                            borderColor: 'divider',
                        }}
                    >
                        <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em' }}>
                            {group.label}
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 1.75, md: 1.75 }, mt: 0.75 }}>
                            {group.signals.map(signal => (
                                <MentalStateScale
                                    key={signal.key}
                                    label={signal.label}
                                    description={signal.description}
                                    lowLabel={signal.lowLabel}
                                    highLabel={signal.highLabel}
                                    value={values[signal.key]}
                                    onChange={value => update(signal.key, value)}
                                />
                            ))}
                        </Box>
                    </Box>
                ))}
            </Stack>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.75 }}>
                <Button
                    type="submit"
                    variant="contained"
                    size="medium"
                    disabled={saving || !goal}
                    startIcon={saving ? <CircularProgress color="inherit" size={18} /> : <CheckCircleOutlineRoundedIcon />}
                >
                    {saving ? 'Checking in…' : 'See my state'}
                </Button>
            </Stack>
        </>
    );

    if (embedded) {
        return (
            <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 1.75, sm: 2.25 } }}>
                {content}
            </Box>
        );
    }

    return (
        <Paper
            component="form"
            onSubmit={handleSubmit}
            elevation={0}
            sx={{ p: { xs: 1.75, sm: 2.25 }, border: 1, borderColor: 'divider', borderRadius: 3, textAlign: 'left' }}
        >
            {content}
        </Paper>
    );
}
