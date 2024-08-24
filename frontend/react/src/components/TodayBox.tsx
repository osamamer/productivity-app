import {DayEntity} from "../interfaces/DayEntity.tsx";
import {OvalButton} from "../pages/HomePage.tsx";
import React from "react";
import Button from "@mui/material/Button";
import {Box, Card, Typography} from "@mui/material";

type props = { today: DayEntity, handleOpenDialog: (dialogType: string) => void };

export function TodayBox(props: props) {
    return (
        <Card  className="box-shadow box"  sx={{
            p: 2,
            color: 'text.primary',
            display: 'flex', gap: 2,
            '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: 6,
            },
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: 3,
            borderRadius: 5,
            minHeight: 200
        }}>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1}}>
                <Typography variant="h4">Today</Typography>

                <Typography variant="h5" color="primary.main">{props.today.rating ?? 'Rate today'}</Typography>
            </Box>

            {/*<Typography>{props.today.rating ?? 'Rate today'}</Typography>*/}
            <Typography variant="h5" sx={{alignText: 'left'}}>{props.today.plan !== 'null' && props.today.plan}</Typography>
            <Typography variant="h5">{'How it\'s going: ' + props.today.summary ?? 'How\'s today been?'}</Typography>
            <Button sx={{width: 1 / 4, alignSelf: 'center'}} variant="outlined" color="primary" onClick={() => {
                props.handleOpenDialog('dayDialog')
            }}>
                Day info
            </Button>
        </Card>
        // <div className="box container" id="day-box">
        //     <p className="box-header">Today</p>
        //     <Button sx={{m: 1}} variant="contained" color="primary" onClick={() => {
        //         props.handleOpenDialog('dayDialog')
        //     }}>
        //         Day info
        //     </Button>
        //     <p>{props.today.rating}</p>
        //     <p>{props.today.plan}</p>
        //     <p>{props.today.summary}</p>
        // </div>
    )
        ;
}