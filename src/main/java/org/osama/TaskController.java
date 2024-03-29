package org.osama;

import org.osama.task.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/task")
@CrossOrigin("*")
public class TaskController {
    private final TaskRepository taskRepository;
    private final TaskService taskService;

    public TaskController(TaskRepository taskRepository, TaskService taskService) {
        this.taskRepository = taskRepository;
        this.taskService = taskService;
    }

    @GetMapping
    public List<Task> getAll() {
        return taskRepository.getAll();
    }
    @GetMapping("/get-non-completed-tasks")
    public List<Task> getNonCompletedTasks() {
        return taskService.getNonCompletedTasks();
    }
    @GetMapping("/get-today-tasks")
    public List<Task> getTodayTasks() {
        return taskService.getTasksByDate(String.valueOf(LocalDate.now()));
    }
    @GetMapping("/get-tasks/{date}")
    public List<Task> getTasksByDate(@PathVariable String date) {
        return taskService.getTasksByDate(date);
    }
    @GetMapping("/get-non-completed-tasks/{date}")
    public List<Task> getNonCompletedTasksByDate(@PathVariable String date) {
        return taskService.getNonCompletedTasksByDate(date);
    }
    @GetMapping("/get-non-completed-today-tasks")
    public List<Task> getNonCompletedTasksToday() {
        return taskService.getNonCompletedTasksByDate(String.valueOf(LocalDate.now()));
    }
        @GetMapping("/get-task/{taskId}")
    public Task getTaskById(@PathVariable String taskId) {
        return taskRepository.getTaskById(taskId);
    }
    @PostMapping("/submit-new-task-form")
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

    @GetMapping("/get-task-scheduled-time/{taskId}")
    public LocalDateTime getTaskScheduledTime(@PathVariable String taskId) {
        return taskRepository.getTaskById(taskId).getScheduledPerformDateTime();
    }
    @GetMapping("/get-task-completion-time/{taskId}")
    public LocalDateTime getTaskCompletionTime(@PathVariable String taskId) {
        return taskRepository.getTaskById(taskId).getCompletionDateTime();
    }
    @GetMapping("/get-task-creation-time/{taskId}")
    public LocalDateTime getTaskCreationTime(@PathVariable String taskId) {
        return taskRepository.getTaskById(taskId).getCreationDateTime();
    }
    @GetMapping("/get-task-parent/{taskId}")
    public Task getTaskParent(@PathVariable String taskId) {
        return taskService.getParentTask(taskId);
    }
    @GetMapping("/get-child-tasks/{taskId}")
    public List<Task> getChildTasks(@PathVariable String taskId) {
        return taskService.getChildTasks(taskId);
    }
    @GetMapping("/get-tag/{taskId}")
    public String getTaskTag(@PathVariable String taskId) {
        return taskRepository.getTaskById(taskId).getTag();
    }
    @GetMapping("/get-importance/{taskId}")
    public int getTaskImportance(@PathVariable String taskId) {
        return taskRepository.getTaskById(taskId).getImportance();
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
}
