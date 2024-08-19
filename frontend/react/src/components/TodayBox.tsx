import {DayEntity} from "../interfaces/DayEntity.tsx";
import {OvalButton} from "../pages/HomePage.tsx";
import React from "react";

type props = {today: DayEntity, handleOpenDialog: (dialogType: string) => void};
export function TodayBox(props: props) {
    return (
        <div className="box container" id="day-box">
            <p className="box-header">Today</p>
            <OvalButton sx={{m:1}} variant="contained" color="primary" onClick={() => {
                props.handleOpenDialog('dayDialog')
            }}>
                Day info
            </OvalButton>
            <p>{props.today.rating}</p>
            <p>{props.today.plan}</p>
            <p>{props.today.summary}</p>
        </div>
    );
}