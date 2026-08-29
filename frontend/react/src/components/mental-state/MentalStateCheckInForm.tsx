import { FormEvent, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { MentalStateCheckIn, MentalStateCheckInRequest } from '../../types/MentalState';
import { mentalStateService } from '../../services/api/mentalStateService';
import { MentalStateScale } from './MentalStateScale';

interface MentalStateCheckInFormProps {
    onSaved: (checkIn: MentalStateCheckIn) => void;
    embedded?: boolean;
}

const INITIAL_STATE: MentalStateCheckInRequest = {
    energy: 5,
    activation: 5,
    stimulationHunger: 5,
    clarity: 5,
    valence: 5,
    emotionalLoad: 5,
};

export function MentalStateCheckInForm({ onSaved, embedded = false }: MentalStateCheckInFormProps) {
    const [values, setValues] = useState<MentalStateCheckInRequest>(INITIAL_STATE);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = (field: keyof MentalStateCheckInRequest, value: number) => {
        setValues(current => ({ ...current, [field]: value }));
    };

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            onSaved(await mentalStateService.checkIn(values));
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                Rate each signal from 1 to 10. Check in again whenever your state changes.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 2.5, md: 2.25 } }}>
                <MentalStateScale
                    label="Energy"
                    description="Physical and mental energy available."
                    lowLabel="empty"
                    highLabel="full"
                    value={values.energy}
                    onChange={value => update('energy', value)}
                />
                <MentalStateScale
                    label="Activation"
                    description="How keyed up or activated your body feels."
                    lowLabel="still"
                    highLabel="keyed up"
                    value={values.activation}
                    onChange={value => update('activation', value)}
                />
                <MentalStateScale
                    label="Stimulation Hunger"
                    description="How strongly you want more stimulation."
                    lowLabel="satisfied"
                    highLabel="craving"
                    value={values.stimulationHunger}
                    onChange={value => update('stimulationHunger', value)}
                />
                <MentalStateScale
                    label="Clarity"
                    description="How clear and organized your mind feels."
                    lowLabel="foggy"
                    highLabel="clear"
                    value={values.clarity}
                    onChange={value => update('clarity', value)}
                />
                <MentalStateScale
                    label="Valence"
                    description="How pleasant or unpleasant this moment feels."
                    lowLabel="unpleasant"
                    highLabel="pleasant"
                    value={values.valence}
                    onChange={value => update('valence', value)}
                />
                <MentalStateScale
                    label="Emotional Load"
                    description="How much emotional weight you are carrying."
                    lowLabel="light"
                    highLabel="heavy"
                    value={values.emotionalLoad}
                    onChange={value => update('emotionalLoad', value)}
                />
            </Box>

            {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2.5 }}>
                <Button
                    type="submit"
                    variant="contained"
                    size="medium"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress color="inherit" size={18} /> : <CheckCircleOutlineRoundedIcon />}
                >
                    {saving ? 'Checking in…' : 'See my state'}
                </Button>
            </Stack>
        </>
    );

    if (embedded) {
        return (
            <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, sm: 2.5 } }}>
                {content}
            </Box>
        );
    }

    return (
        <Paper
            component="form"
            onSubmit={handleSubmit}
            elevation={0}
            sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: 'divider', borderRadius: 3, textAlign: 'left' }}
        >
            {content}
        </Paper>
    );
}
