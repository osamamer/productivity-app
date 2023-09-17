package org.osama;

import lombok.Data;
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
    public void removeTask(@RequestBody DeleteTaskRequest deleteTaskRequest) {
        taskRepository.remove(deleteTaskRequest.getTaskId());
    }

    @Data
    static class DeleteTaskRequest {
        String taskId;

    }

    @Data
    static class NewTaskRequest {
        String taskName;
        String taskDescription;
    }

}
