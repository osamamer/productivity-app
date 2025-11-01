import {DayEntity} from "../../types/DayEntity.tsx";
import React, {useEffect, useState} from "react";
import {Box, Typography} from "@mui/material";
import summary from "../../assets/images/summary.png"
import plan from "../../assets/images/walk.png";
import {DayInfoDiv} from "../DayInfoDiv.tsx";
import {RatingDisplay} from "../RatingDisplay.tsx";
import {HoverCardBox} from "./HoverCardBox";
import {useAppTheme} from "../../contexts/ThemeContext";
import {dayService} from "../../services/api";

type props = { handleOpenDialog: (dialogType: string) => void };

export function TodayBox(props: props) {
    const darkMode = useAppTheme();
    const [today, setToday] = useState<DayEntity>({} as DayEntity);

    useEffect(() => {
        fetchToday();
    }, []);

    async function setTodayInfo(updates: Partial<{
        rating: number;
        plan: string;
        summary: string;
    }>) {
        try {
            await dayService.setTodayInfo(
                updates.rating ?? today.rating,
                updates.plan ?? today.plan,
                updates.summary ?? today.summary
            );
            const updatedToday = await dayService.getToday();
            setToday(updatedToday);
        } catch (err) {
            console.error('Error setting today info:', err);
        }
    }

    async function fetchToday() {
        try {
            const todayData = await dayService.getToday();
            setToday(todayData);
        } catch (err) {
            console.error('Error fetching today:', err);
        }
    }

    return (
        <HoverCardBox>
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 2,
                borderBottom: 1,
                borderColor: 'divider',
            }}>
                <Typography variant="h4">Today</Typography>
                <RatingDisplay
                    rating={today.rating}
                    onSubmit={(newRating) => setTodayInfo({ rating: newRating })}
                />
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    pt: 2,
                }}
            >
                <DayInfoDiv
                    type="plan"
                    image={plan as string}
                    info={today.plan}
                    onSubmit={(newPlan) => setTodayInfo({ plan: newPlan })}
                />
                <DayInfoDiv
                    type="summary"
                    image={summary as string}
                    info={today.summary}
                    onSubmit={(newSummary) => setTodayInfo({ summary: newSummary })}
                />
            </Box>
        </HoverCardBox>
    )
}