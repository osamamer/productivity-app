package org.osama;

import org.osama.task.*;
import org.osama.task.requests.ModifyTaskRequest;
import org.osama.task.requests.NewTaskRequest;
import org.osama.task.requests.PomodoroRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        return taskRepository.findAll();
    }

    @GetMapping("/get-partitioned-tasks")
    public Map<String, List<Task>> getPartitionedTasks() {
        HashMap<String, List<Task>> taskMap = new HashMap<>();
        taskMap.put("Past", taskService.getPastTasks());
        taskMap.put("Today", taskService.getTodayTasks());
        taskMap.put("Future", taskService.getFutureTasks());
        return taskMap;
    }

    @GetMapping("/get-non-completed-tasks")
    public List<Task> getNonCompletedTasks() {
        return taskService.getNonCompletedTasks();
    }

    @GetMapping("/get-today-tasks")
    public List<Task> getTodayTasks() {
        return taskService.getTasksByDate(String.valueOf(LocalDate.now()));
    }

    @GetMapping("/get-all-but-today-tasks")
    public List<Task> getAllButToday() {
        return taskService.getAllButDay(String.valueOf(LocalDate.now()));
    }

    @GetMapping("/get-past-tasks")
    public List<Task> getPastTasks() {
        return taskService.getPastTasks();
    }

    @GetMapping("/get-future-tasks")
    public List<Task> getFutureTasks() {
        return taskService.getFutureTasks();
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
        return taskRepository.findTaskByTaskId(taskId);
    }

    @PostMapping("/create-task")
    public Task createTask(@RequestBody NewTaskRequest taskRequest) {
        return taskService.createNewTask(taskRequest);
    }

    @PostMapping("/start-session/{taskId}")
    public void startTaskSession(@PathVariable String taskId) {
        taskService.startTaskSession(taskId, false);
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

    @PostMapping("/uncomplete-task/{taskId}")
    public void uncompleteTask(@PathVariable String taskId) {
        taskService.uncompleteTask(taskId);
    }

    @PostMapping("/toggle-task-completion/{taskId}")
    public void toggleTaskCompletion(@PathVariable String taskId) {
        taskService.toggleTaskCompletion(taskId);
    }

    @PostMapping("/change-task-name/{taskId}/{newName}")
    public void changeTaskName(@PathVariable String taskId, @PathVariable String newName) {
        taskService.changeTaskName(taskId, newName);
    }

    @GetMapping("/get-task-scheduled-time/{taskId}")
    public LocalDateTime getTaskScheduledTime(@PathVariable String taskId) {
        return taskRepository.findTaskByTaskId(taskId).getScheduledPerformDateTime();
    }

    @GetMapping("/get-task-completion-time/{taskId}")
    public LocalDateTime getTaskCompletionTime(@PathVariable String taskId) {
        return taskRepository.findTaskByTaskId(taskId).getCompletionDateTime();
    }

    @GetMapping("/get-task-creation-time/{taskId}")
    public LocalDateTime getTaskCreationTime(@PathVariable String taskId) {
        return taskRepository.findTaskByTaskId(taskId).getCreationDateTime();
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
        return taskRepository.findTaskByTaskId(taskId).getTag();
    }

    @GetMapping("/get-importance/{taskId}")
    public int getTaskImportance(@PathVariable String taskId) {
        return taskRepository.findTaskByTaskId(taskId).getImportance();
    }

    @GetMapping("/get-newest-uncompleted-highest-priority-task")
    public Task getNewestUncompletedHighestPriorityTask() {
        return taskService.getNewestUncompletedHighestPriorityTask();
    }

    @PostMapping("/start-pomodoro")
    public void startPomodoro(@RequestBody PomodoroRequest pomodoroRequest) {
        taskService.startPomodoro(pomodoroRequest.taskId, pomodoroRequest.focusDuration,
                pomodoroRequest.shortBreakDuration, pomodoroRequest.longBreakDuration,
                pomodoroRequest.numFocuses, pomodoroRequest.longBreakCooldown);
    }

    @DeleteMapping("/{taskId}")
    public void removeTask(@PathVariable String taskId) {
        taskRepository.deleteTaskByTaskId(taskId);
    }

    @DeleteMapping
    public void removeAllTasks() {
        for (int i = 0; i < taskRepository.findAll().size(); i++) {
            taskRepository.deleteTaskByTaskId(taskRepository.findAll().get(i).getTaskId());
        }
    }

    @PostMapping("/end-all-sessions")
    public void endAllSessions() {
        taskService.endAllSessions();
    }
}
