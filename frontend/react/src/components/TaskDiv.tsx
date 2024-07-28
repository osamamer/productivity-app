import {Task} from "../interfaces/Task.tsx";

type props = {task: Task, toggleTaskCompletion: (taskId: number) => void, onClick: (task) => void};



export function TaskDiv(props: props) {
    return (
        <div className="task-div" onClick={() => {
            props.onClick(props.task)}
        }>
            <label>
                <input
                    type="checkbox"
                    className="task-button"
                    checked={props.task.completed}
                    onChange={() => {
                        props.toggleTaskCompletion(props.task.taskId)}
                    }
                />
            </label>
            <div className="task-div-text">{props.task.name}</div>
        </div>
    );
}