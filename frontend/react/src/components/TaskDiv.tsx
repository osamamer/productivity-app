import {Task} from "../interfaces/Task.tsx";
import {Card, Checkbox, Paper, Typography} from "@mui/material";

type props = { task: Task, toggleTaskCompletion: (taskId: string) => void, onClick: (task: Task) => void };


function Circle() {
    return (
        <div className="circle"></div>
    );
}

export function TaskDiv(props: props) {
    let importance;
    if (props.task.importance <= 3) {
        importance = "low";
    } else if (3 < props.task.importance && props.task.importance <= 7) {
        importance = "medium";
    } else {
        importance = "high";

    }
    const divStyle = {
        display: 'block',
        content: "",
        minWidth: '12px',
        minHeight: '12px',
        height: '12px',
        width: '12px',
        borderRadius: '50%',
        marginLeft: 15,
        zIndex: 10000,
        right: '-10px',
        backgroundColor: importance === 'low'
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
                transform: 'scale(1.05)',
                boxShadow: 6,
            },
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: 3,
            borderRadius: 3,
        }} onClick={() => {
            props.onClick(props.task)
        }
        }>
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
            <Typography className="task-div-text">{props.task.name}</Typography>
            <div className="circle" style={divStyle}></div>
        </Card>
    );
}