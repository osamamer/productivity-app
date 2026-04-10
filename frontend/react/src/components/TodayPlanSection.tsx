import React from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DayInfoDiv } from './DayInfoDiv';
import { DayEntity } from '../types/DayEntity';
import plan from '../assets/images/walk.png';
import summary from '../assets/images/summary.png';

type TodayPlanSectionProps = {
    today: DayEntity;
    onPlanSubmit: (value: string) => void;
    onSummarySubmit: (value: string) => void;
};

export function TodayPlanSection({ today, onPlanSubmit, onSummarySubmit }: TodayPlanSectionProps) {
    return (
        <Accordion
            disableGutters
            elevation={3}
            sx={{
                borderRadius: 2,
                '&:before': { display: 'none' },
                flexShrink: 0,
            }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Today's Plan & Summary</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: '1 1 300px' }}>
                        <DayInfoDiv
                            type="plan"
                            image={plan as string}
                            info={today.plan}
                            onSubmit={onPlanSubmit}
                        />
                    </Box>
                    <Box sx={{ flex: '1 1 300px' }}>
                        <DayInfoDiv
                            type="summary"
                            image={summary as string}
                            info={today.summary}
                            onSubmit={onSummarySubmit}
                        />
                    </Box>
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}
