import {Task} from "../interfaces/Task.tsx";
type props = {tasks: Task[]};
export function TaskList(props: props) {

    return  (
    <div>
      {props.tasks.map((task: Task) => (
          <div key={task.taskId}>
              <h2>{task.name}</h2>
              <h3>{String(task.completed)}</h3>
          </div>
      ))}
    </div>
    );
}