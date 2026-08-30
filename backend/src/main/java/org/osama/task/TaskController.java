package org.osama.task;

import org.osama.requests.UpdateTaskRequest;
import org.osama.requests.NewTaskRequest;
import org.osama.user.CurrentUserService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {
    private final TaskService taskService;
    private final CurrentUserService currentUserService;

    public TaskController(TaskService taskService, CurrentUserService currentUserService) {
        this.taskService = taskService;
        this.currentUserService = currentUserService;
    }

    // ============ Main Query Endpoint ============

    @GetMapping
    public ResponseEntity<List<Task>> getTasks(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate date,

            @RequestParam(required = false)
            TaskQuery.DatePeriod period,

            @RequestParam(required = false)
            Boolean completed,

            @RequestParam(required = false)
            String parentId,

            @RequestParam(required = false)
            Integer minImportance,

            @RequestParam(required = false)
            String tag
    ) {
        String userId = currentUserService.getCurrentUserId();
        TaskQuery query = TaskQuery.builder()
                .date(date)
                .period(period)
                .completed(completed)
                .parentId(parentId)
                .minImportance(minImportance)
                .tag(tag)
                .userId(userId)
                .build();

        List<Task> tasks = taskService.findTasks(query);
        return ResponseEntity.ok(tasks);
    }

    @PutMapping("/order")
    public ResponseEntity<List<Task>> reorderTasks(@RequestBody ReorderTasksRequest request) {
        return ResponseEntity.ok(taskService.reorderMainTasks(
                request.getTaskIds(), currentUserService.getCurrentUserId()));
    }

    // ============ Single Task Operations ============

    @GetMapping("/{taskId}")
    public ResponseEntity<Task> getTask(@PathVariable String taskId) {
        return taskService.getTaskForUser(taskId, currentUserService.getCurrentUserId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{taskId}/pomodoro-stats")
    public ResponseEntity<TaskPomodoroStatsResponse> getPomodoroStats(@PathVariable String taskId) {
        return ResponseEntity.ok(taskService.getPomodoroStats(taskId, currentUserService.getCurrentUserId()));
    }

    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody @Valid NewTaskRequest request) {
        String userId = currentUserService.getCurrentUserId();
        Task task = taskService.createTask(request, userId);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(task.getTaskId())
                .toUri();
        return ResponseEntity.created(location).body(task);
    }

    @PatchMapping("/{taskId}")
    public ResponseEntity<Task> updateTask(
            @PathVariable String taskId,
            @RequestBody @Valid UpdateTaskRequest request
    ) {
        return taskService.updateTask(taskId, request, currentUserService.getCurrentUserId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable String taskId) {
        taskService.deleteTask(taskId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    // ============ Subtask Operations ============

    @GetMapping("/{taskId}/subtasks")
    public ResponseEntity<List<Task>> getSubtasks(@PathVariable String taskId) {
        String userId = currentUserService.getCurrentUserId();
        // Verify parent task exists
        if (taskService.getTaskForUser(taskId, userId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        List<Task> subtasks = taskService.getSubtasks(taskId, userId);
        return ResponseEntity.ok(subtasks);
    }

    @PostMapping("/{taskId}/subtasks")
    public ResponseEntity<Task> createSubtask(
            @PathVariable String taskId,
            @RequestBody @Valid NewTaskRequest request
    ) {
        String userId = currentUserService.getCurrentUserId();
        // Set parent ID
        request.setParentId(taskId);

        Task subtask = taskService.createTask(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(subtask);
    }

    // ============ Convenience Endpoints (Optional - for backward compatibility) ============

    @GetMapping("/main")
    public ResponseEntity<List<Task>> getMainTasks() {
        return ResponseEntity.ok(taskService.getAllMainTasks(currentUserService.getCurrentUserId()));
    }

    @GetMapping("/today")
    public ResponseEntity<List<Task>> getTodayTasks() {
        return ResponseEntity.ok(taskService.getTodayTasks(currentUserService.getCurrentUserId()));
    }

    @GetMapping("/incomplete")
    public ResponseEntity<List<Task>> getIncompleteTasks() {
        return ResponseEntity.ok(taskService.getIncompleteTasks(currentUserService.getCurrentUserId()));
    }

    @GetMapping("/highest-priority")
    public ResponseEntity<Task> getHighestPriorityTask() {
        return taskService.getHighestPriorityIncompleteTask(currentUserService.getCurrentUserId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
