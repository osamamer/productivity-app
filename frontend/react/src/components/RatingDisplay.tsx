import React, { useState } from 'react';
import { Box, Rating, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';

type RatingDisplayProps = {
    rating?: number; // 0-10 from backend
    onSubmit: (rating: number) => void; // sends 0-10 to backend
};

export function RatingDisplay({ rating, onSubmit }: RatingDisplayProps) {
    const [hover, setHover] = useState(-1);

    const labels: { [index: number]: string } = {
        1: 'Terrible',
        2: 'Poor',
        3: 'Okay',
        4: 'Good',
        5: 'Excellent',
    };

    // Convert backend rating (0-10) to star rating (0-5)
    const starsValue = rating !== undefined ? rating / 2 : 0;

    const handleChange = (_event: React.SyntheticEvent, newValue: number | null) => {
        if (newValue !== null) {
            // Convert star rating (0-5) to backend scale (0-10)
            const backendRating = newValue * 2;
            onSubmit(backendRating);
        }
    };

    // Get color based on star value (or hover)
    const getColor = (value: number): string => {
        if (value <= 1) return '#ef4444'; // red
        if (value <= 2) return '#f97316'; // orange
        if (value <= 3) return '#eab308'; // yellow
        if (value <= 4) return '#84cc16'; // lime
        return '#22c55e'; // green
    };

    const displayValue = hover !== -1 ? hover : starsValue;
    const currentColor = getColor(displayValue);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
            }}
        >
            <Rating
                value={starsValue}
                precision={0.5} // Allow half stars
                onChange={handleChange}
                onChangeActive={(_event, newHover) => {
                    setHover(newHover);
                }}
                icon={<StarIcon fontSize="inherit" />}
                emptyIcon={<StarIcon fontSize="inherit" />}
                sx={{
                    fontSize: '2rem',
                    '& .MuiRating-iconFilled': {
                        color: currentColor,
                    },
                    '& .MuiRating-iconHover': {
                        color: currentColor,
                    },
                    '& .MuiRating-iconEmpty': {
                        color: 'action.disabled',
                    },
                }}
            />
            {(rating !== undefined && rating !== null) || hover !== -1 ? (
                <Typography
                    variant="body2"
                    sx={{
                        minWidth: '70px',
                        color: currentColor,
                        fontWeight: 500,
                    }}
                >
                    {labels[Math.ceil(hover !== -1 ? hover : starsValue)]}
                </Typography>
            ) : (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic' }}
                >
                    Rate today
                </Typography>
            )}
        </Box>
    );
}