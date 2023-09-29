package org.osama;

import lombok.Data;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/task")
@CrossOrigin("*")
public class Controller {
    private final TaskRepository taskRepository;
    private final TaskService taskService;

    public Controller(TaskRepository taskRepository, TaskService taskService) {
        this.taskRepository = taskRepository;
        this.taskService = taskService;
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
    @PostMapping("/start-session{taskId}")
    public void startTaskSession(@PathVariable String taskId) {
        taskService.startTaskSession(taskId);
    }
    @PostMapping("/end-session{taskId}")
    public void endTaskSession(@PathVariable String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        taskService.endTaskSession(taskId, task.getActiveSession());
    }
    @DeleteMapping("/{taskId}")
    public void removeTask(@PathVariable String taskId) {
        taskRepository.remove(taskId);
    }
    @DeleteMapping
    public void removeAllTasks() {
        for (int i = 0; i < taskRepository.getAll().size(); i++) {
            taskRepository.remove(taskRepository.getAll().get(i).getTaskID());
        }
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

    @Data
    static class ModifyTaskRequest {
        String taskId;
    }

}
