import {Task} from "../interfaces/Task.tsx";
import {Card, Checkbox, Typography} from "@mui/material";

type props = { task: Task, toggleTaskCompletion: (taskId: string) => void, onClick: (task: Task) => void };


function Circle() {
    return (
        <div className="circle"></div>
    );
}
const formatTime = (dateTime: string): string => {
    const date = new Date(dateTime);
    const now = new Date();

    const isSameDay =
        now.getFullYear() === date.getFullYear() &&
        now.getMonth() === date.getMonth() &&
        now.getDate() === date.getDate();

    if (isSameDay) return "Today";

    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return dayNames[date.getDay()];
};

export function TaskDiv(props: props) {
    let importance;
    let title;
    if (props.task.importance <= 3) {
        importance = "low";
        title = "Low importance task";
    } else if (3 < props.task.importance && props.task.importance <= 7) {
        importance = "medium";
        title = "Medium importance task";
    } else {
        importance = "high";
        title = "High importance task";
    }
    const divStyle = {
        // display: 'block',
        // content: "",
        // minWidth: '12px',
        // minHeight: '12px',
        // height: '12px',
        // width: '12px',
        // borderRadius: '50%',
        // marginLeft: 15,
        zIndex: 100,
        right: '-10px',
        color: importance === 'low'
            ? ' var(--priorityblue)'
            : importance === 'medium'
                ? 'var(--priorityyellow)'
                : importance === 'high'
                    ? 'var(--priorityred)'
                    : 'grey',

    }
    return (
        <Card className="task-div" sx={{
            '&:hover': {
                transform: 'scale(1.03)',
                boxShadow: 6,
            },
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: 3,
            borderRadius: 2,
        }} onClick={() => {
            props.onClick(props.task)
        }
        }>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flex: 1,
                minWidth: 0
            }}>
                <Checkbox size="small" checked={props.task.completed}
                          onChange={() => {
                              props.toggleTaskCompletion(props.task.taskId)
                          }
                          }>

                </Checkbox>
                {/*<label>*/}
                {/*    <input*/}
                {/*        type="checkbox"*/}
                {/*        className="task-button"*/}
                {/*        checked={props.task.completed}*/}
                {/*        onChange={() => {*/}
                {/*            props.toggleTaskCompletion(props.task.taskId)}*/}
                {/*        }*/}
                {/*    />*/}
                {/*</label>*/}
                <Typography
                    sx={{
                        color: props.task.completed ? "gray" : "inherit",
                        display: "-webkit-box",
                        overflow: "hidden",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 4,   // <-- max number of lines before cutting off
                        lineHeight: 1.4,
                        maxHeight: "5.6em",   // 4 * lineHeight → ensures container height
                    }}
                >
                    {props.task.name}
                </Typography>
            </div>

            <Typography className="circle" style={divStyle}>
                {formatTime(props.task.scheduledPerformDateTime)}
            </Typography>
            {/*<div className="circle" title={title} style={divStyle}></div>*/}
        </Card>
    );
}