package org.osama;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/task")
@CrossOrigin("*")
public class Controller {
    private final TaskRepository taskRepository;

    public Controller(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @GetMapping
    public List<Task> getAll() {
        return taskRepository.getAll();
    }

    @PostMapping
    public Task createTask(@RequestBody NewTaskRequest taskRequest) {
        Task newTask = Task.createNewTask(taskRequest.taskName, taskRequest.taskDescription);
        taskRepository.add(newTask);
        return newTask;
    }
    @DeleteMapping
    public void removeTask(@RequestBody NewTaskRequest taskRequest) {
        taskRepository.remove(taskRequest.getTaskId());
    }

    static class NewTaskRequest {
        String taskName;
        String taskDescription;
        String taskId;

        public String getTaskId() {
            return taskId;
        }

        public void setTaskId(String taskId) {
            this.taskId = taskId;
        }

        public String getTaskName() {
            return taskName;
        }

        public void setTaskName(String taskName) {
            this.taskName = taskName;
        }

        public String getTaskDescription() {
            return taskDescription;
        }

        public void setTaskDescription(String taskDescription) {
            this.taskDescription = taskDescription;
        }
    }

}
