import {DayEntity} from "../interfaces/DayEntity.tsx";
import {OvalButton} from "../pages/HomePage.tsx";
import React from "react";
import Button from "@mui/material/Button";
import {Box, Card, Typography} from "@mui/material";
import summary from "../assets/images/summary.png"
import plan from "../assets/images/walk.png";
import {InfoDiv} from "./InfoDiv.tsx";
type props = { today: DayEntity, handleOpenDialog: (dialogType: string) => void, darkMode: boolean };
import altDayIcon from '../assets/images/time.png'
import {HoverCardBox} from "./HoverCardBox";
export function TodayBox(props: props) {
    return (
        <HoverCardBox>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1}}>
                <Typography variant="h4">Today</Typography>

                <Typography title="Today's rating" variant="h5" color="primary.main">{props.today.rating ?? 'Rate today'}</Typography>
            </Box>
            <InfoDiv type="plan" image={plan as string} info={props.today.plan} onClick={() => {}} darkMode={props.darkMode}></InfoDiv>
            <InfoDiv type="summary" image={summary as string} info={props.today.summary} onClick={() => {}} darkMode={props.darkMode}></InfoDiv>

            {/*<Typography>{props.today.rating ?? 'Rate today'}</Typography>*/}
            {/*<Typography variant="h5" sx={{alignText: 'left'}}>{props.today.plan !== 'null' && props.today.plan}</Typography>*/}
            {/*<Typography variant="h5">{props.today.summary !== 'null' && props.today.summary}</Typography>*/}
            <Button sx={{width: '50%', alignSelf: 'center'}} variant="outlined" color="primary" onClick={() => {
                props.handleOpenDialog('dayDialog')
            }} >
                How's today been?
            </Button>
        </HoverCardBox>
    )
}