package org.osama.task;

import org.osama.requests.UpdateTaskRequest;
import org.osama.requests.NewTaskRequest;
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
@CrossOrigin(origins = "http://localhost:5173")
public class TaskController {
    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
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
        TaskQuery query = TaskQuery.builder()
                .date(date)
                .period(period)
                .completed(completed)
                .parentId(parentId)
                .minImportance(minImportance)
                .tag(tag)
                .build();

        List<Task> tasks = taskService.findTasks(query);
        return ResponseEntity.ok(tasks);
    }

    // ============ Single Task Operations ============

    @GetMapping("/{taskId}")
    public ResponseEntity<Task> getTask(@PathVariable String taskId) {
        return taskService.getTask(taskId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody @Valid NewTaskRequest request) {
        Task task = taskService.createTask(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(task);
    }

    @PatchMapping("/{taskId}")
    public ResponseEntity<Task> updateTask(
            @PathVariable String taskId,
            @RequestBody UpdateTaskRequest request
    ) {
        return taskService.updateTask(taskId, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable String taskId) {
        taskService.deleteTask(taskId);
        return ResponseEntity.noContent().build();
    }

    // ============ Subtask Operations ============

    @GetMapping("/{taskId}/subtasks")
    public ResponseEntity<List<Task>> getSubtasks(@PathVariable String taskId) {
        // Verify parent task exists
        if (taskService.getTask(taskId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        List<Task> subtasks = taskService.getSubtasks(taskId);
        return ResponseEntity.ok(subtasks);
    }

    @PostMapping("/{taskId}/subtasks")
    public ResponseEntity<Task> createSubtask(
            @PathVariable String taskId,
            @RequestBody NewTaskRequest request
    ) {
        // Verify parent task exists
        if (taskService.getTask(taskId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // Set parent ID
        request.setParentId(taskId);

        Task subtask = taskService.createTask(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(subtask);
    }

    // ============ Convenience Endpoints (Optional - for backward compatibility) ============

    @GetMapping("/main")
    public ResponseEntity<List<Task>> getMainTasks() {
        return ResponseEntity.ok(taskService.getAllMainTasks());
    }

    @GetMapping("/today")
    public ResponseEntity<List<Task>> getTodayTasks() {
        return ResponseEntity.ok(taskService.getTodayTasks());
    }

    @GetMapping("/incomplete")
    public ResponseEntity<List<Task>> getIncompleteTasks() {
        return ResponseEntity.ok(taskService.getIncompleteTasks());
    }

    @GetMapping("/highest-priority")
    public ResponseEntity<Task> getHighestPriorityTask() {
        return taskService.getHighestPriorityIncompleteTask()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}