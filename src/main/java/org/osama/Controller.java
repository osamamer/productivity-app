package org.osama;

import lombok.Data;
import org.osama.day.*;
import org.osama.task.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/task")
@CrossOrigin("*")
public class Controller {
    private final TaskRepository taskRepository;
    private final TaskService taskService;
    private final DayService dayService;

    public Controller(TaskRepository taskRepository, TaskService taskService, DayService dayService) {
        this.taskRepository = taskRepository;
        this.taskService = taskService;
        this.dayService = dayService;
    }

    @GetMapping
    public List<Task> getAll() {
        return taskRepository.getAll();
    }
    @GetMapping("/get-task/{taskId}")
    public Task getTaskById(@PathVariable String taskId) {
        return taskRepository.getTaskById(taskId);
    }
    @PostMapping
    public Task createTask(@RequestBody NewTaskRequest taskRequest) {
        return taskService.createNewTask(taskRequest);
    }
    @PostMapping("/start-session/{taskId}")
    public void startTaskSession(@PathVariable String taskId) {
        taskService.startTaskSession(taskId);
    }
    @PostMapping("/end-session/{taskId}")
    public void endTaskSession(@PathVariable String taskId) {
        taskService.endTaskSession(taskId);
    }
    @PostMapping("/set-description")
    public void setTaskDescription(@RequestBody ModifyTaskRequest taskRequest) {
        taskService.setTaskDescription(taskRequest);
    }
    @GetMapping("/get-task-running/{taskId}")
    public boolean getTaskRunning(@PathVariable String taskId) {
        return taskService.isActive(taskId);
    }
    @GetMapping("/get-accumulated-time/{taskId}")
    public long getAccumulatedTime(@PathVariable String taskId) {
        return taskService.getAccumulatedTime(taskId).getSeconds();
    }
    @GetMapping("get-today")
    public Optional<Day> getToday() {
        return dayService.getToday();
    }

    @DeleteMapping("/{taskId}")
    public void removeTask(@PathVariable String taskId) {
        taskRepository.remove(taskId);
    }
    @DeleteMapping
    public void removeAllTasks() {
        for (int i = 0; i < taskRepository.getAll().size(); i++) {
            taskRepository.remove(taskRepository.getAll().get(i).getTaskId());
        }
    }

    @Data
    static class DeleteTaskRequest {
        String taskId;
    }
    @Data
    static class DayRequest {
        LocalDateTime localDateTime;
    }



}
