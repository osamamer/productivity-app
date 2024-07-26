import React from "react";

export function CreateTaskModal() {
    return (
        <dialog id="create-task-modal" className="modal box-shadow">
            <div className="dialogue-head">Create new task:</div>
            <form id="create-new-task-form" autoComplete="off" method="dialog">
                <p><input id="task-name-input-field" type="text" placeholder="Task name" value=""
                          className="input"></input></p>
                <p><input id="task-desc-input-field" type="text" placeholder="Task description" value=""
                          className="input"></input></p>
                <p><input id="task-scheduled-input-field" type="text" placeholder="Task scheduled perform date"
                          value="" className="input"></input></p>
                <p><input id="task-tag-input-field" type="text" placeholder="Task tag" value=""
                          className="input"></input></p>
                <p><input id="task-importance-input-field" type="number" placeholder="Task importance" value=""
                          className="input" min="0" max="10"></input></p>

                <button className="button-class" type="submit">OK</button>
            </form>
        </dialog>
    );
}