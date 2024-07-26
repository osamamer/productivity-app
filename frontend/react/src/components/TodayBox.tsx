import {DayEntity} from "../interfaces/DayEntity.tsx";

type props = {today: DayEntity};
export function TodayBox(props: props) {
    return (
        <div className="box container" id="day-box">
            <p className="box-header">Today</p>
            <p>{props.today.rating}</p>
            <p>{props.today.plan}</p>
            <p>{props.today.summary}</p>
        </div>
    );
}