package org.osama;

import lombok.Data;
import org.osama.day.*;
import org.osama.task.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
    @PostMapping("/pause-session/{taskId}")
    public void pauseTaskSession(@PathVariable String taskId) {
        taskService.pauseTaskSession(taskId);
    }
    @PostMapping("/unpause-session/{taskId}")
    public void unpauseTaskSession(@PathVariable String taskId) {
        taskService.unpauseTaskSession(taskId);
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
        return taskService.getTaskRunning(taskId);
    }
    @GetMapping("/get-task-active/{taskId}")
    public boolean getTaskActive(@PathVariable String taskId) {
        return taskService.getTaskActive(taskId);
    }
    @GetMapping("/get-accumulated-time/{taskId}")
    public long getAccumulatedTime(@PathVariable String taskId) {
        return taskService.getAccumulatedTime(taskId).toSeconds();
    }
    @PostMapping("/complete-task/{taskId}")
    public void completeTask(@PathVariable String taskId) {
        taskService.completeTask(taskId);
    }
    @PostMapping("/change-task-name/{taskId}/{newName}")
    public void changeTaskName(@PathVariable String taskId, @PathVariable String newName) {
        taskService.changeTaskName(taskId, newName);
    }
    @GetMapping("/get-today")
    public DayEntity getToday() {
        return dayService.getToday();
    }
    @PostMapping("/set-day-rating/{date}/{rating}")
    public void setDayRating(@PathVariable String date, @PathVariable double rating) {
        dayService.setDayRating(date, rating);
    }
    @PostMapping("/set-today-rating/{rating}")
    public void setTodayRating(@PathVariable double rating) {
        dayService.setTodayRating(rating);
    }
    @PostMapping("/set-day-plan/{date}/{plan}")
    public void setDayPlan(@PathVariable String date, @PathVariable String plan) {
        dayService.setDayPlan(date, plan);
    }
    @PostMapping("/set-day-summary/{date}/{summary}")
    public void setDaySummary(@PathVariable String date, @PathVariable String summary) {
        dayService.setDaySummary(date, summary);
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
    @PostMapping("/end-all-sessions")
    public void endAllSessions() {
        taskService.endAllSessions();
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
