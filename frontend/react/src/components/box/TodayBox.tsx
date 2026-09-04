import {DayEntity} from "../../types/DayEntity.tsx";
import React, {useEffect, useRef, useState} from "react";
import {Box, Typography} from "@mui/material";
import summary from "../../assets/images/summary.png"
import plan from "../../assets/images/walk.png";
import {DayInfoDiv} from "../DayInfoDiv.tsx";
import {RatingDisplay} from "../RatingDisplay.tsx";
import {HoverCardBox} from "./HoverCardBox";
import {dayService} from "../../services/api";
import { dayRatingFeedback, playAudioFeedback } from '../../services/audioFeedback';

export function TodayBox() {
    const [today, setToday] = useState<DayEntity>({} as DayEntity);
    const todayRef = useRef<DayEntity>({} as DayEntity);
    const todayMutationVersionRef = useRef(0);

    useEffect(() => {
        fetchToday();
    }, []);

    async function setTodayInfo(updates: Partial<{
        rating: number;
        plan: string;
        summary: string;
    }>) {
        const previous = todayRef.current;
        const next = { ...previous, ...updates };
        const mutationVersion = todayMutationVersionRef.current + 1;
        todayMutationVersionRef.current = mutationVersion;
        todayRef.current = next;
        setToday(next);
        try {
            await dayService.setTodayInfo(
                next.rating,
                next.plan,
                next.summary
            );
            if (updates.rating !== undefined && updates.rating !== previous.rating) {
                const feedback = dayRatingFeedback(updates.rating, 10);
                if (feedback) playAudioFeedback(feedback);
            }
        } catch (err) {
            if (todayMutationVersionRef.current === mutationVersion) {
                todayRef.current = previous;
                setToday(previous);
            }
            console.error('Error setting today info:', err);
        }
    }

    async function fetchToday() {
        try {
            const todayData = await dayService.getToday();
            todayRef.current = todayData;
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
