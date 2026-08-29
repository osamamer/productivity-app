import { useEffect, useState } from 'react';
import { Box, CircularProgress, Paper } from '@mui/material';
import { MentalStateCheckIn } from '../../types/MentalState';
import { MentalStateCheckInForm } from './MentalStateCheckInForm';
import { MentalStateResult } from './MentalStateResult';

interface MentalStateCardProps {
    loading: boolean;
    checkIn: MentalStateCheckIn | null;
    isCurrent: boolean;
    onSaved: (checkIn: MentalStateCheckIn) => void;
}

export function MentalStateCard({ loading, checkIn, isCurrent, onSaved }: MentalStateCardProps) {
    const [isCheckingIn, setIsCheckingIn] = useState(!checkIn);

    useEffect(() => {
        setIsCheckingIn(!checkIn);
    }, [checkIn]);

    return (
        <Paper
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden', textAlign: 'left' }}
        >
            {loading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}>
                    <CircularProgress size={30} />
                </Box>
            ) : checkIn && !isCheckingIn ? (
                <MentalStateResult
                    checkIn={checkIn}
                    isCurrent={isCurrent}
                    onRecheck={() => setIsCheckingIn(true)}
                    embedded
                />
            ) : (
                <MentalStateCheckInForm onSaved={onSaved} embedded />
            )}
        </Paper>
    );
}
