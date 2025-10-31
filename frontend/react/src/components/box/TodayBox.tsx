import {DayEntity} from "../../types/DayEntity.tsx";
import React from "react";
import Button from "@mui/material/Button";
import {Box, Card, Typography} from "@mui/material";
import summary from "../../assets/images/summary.png"
import plan from "../../assets/images/walk.png";
import {DayInfoDiv} from "../DayInfoDiv.tsx";
type props = { today: DayEntity | null, handleOpenDialog: (dialogType: string) => void };
import {HoverCardBox} from "./HoverCardBox";
import {useAppTheme} from "../../contexts/ThemeContext";

export function TodayBox(props: props) {
    const darkMode = useAppTheme();
    if (!props.today) {
        return <div>Loading today's information...</div>;
    }
    return (
        <HoverCardBox>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1}}>
                <Typography variant="h4">Today</Typography>

                <Typography title="Today's rating" variant="h5" color="primary.main">{props.today.rating ?? 'Rate today'}</Typography>
            </Box>
            <DayInfoDiv type="plan" image={plan as string} info={props.today.plan} onClick={() => {}} ></DayInfoDiv>
            <DayInfoDiv type="summary" image={summary as string} info={props.today.summary} onClick={() => {}}></DayInfoDiv>
            <Button sx={{width: '50%', alignSelf: 'center'}} variant="outlined" color="primary" onClick={() => {
                props.handleOpenDialog('dayDialog')
            }} >
                How's today been?
            </Button>
        </HoverCardBox>
    )
}