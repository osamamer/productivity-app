package org.osama.task;


import org.osama.requests.UpdateTaskRequest;
import org.osama.requests.NewTaskRequest;
import org.osama.session.Session;
import org.osama.session.SessionRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
public class TaskService {
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;

    public TaskService(TaskRepository taskRepository, SessionRepository sessionRepository) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
    }

    public List<Task> findTasks(TaskQuery query) {
        Specification<Task> spec = TaskSpecifications.matchesQuery(query);

        // Add sorting
        Sort sort = Sort.by(
                Sort.Order.asc("completed"),
                Sort.Order.desc("importance"),
                Sort.Order.desc("creationDateTime")
        );

        return taskRepository.findAll(spec, sort);
    }

    public Optional<Task> getTask(String taskId) {
        return taskRepository.findTaskByTaskId(taskId);
    }

    public List<Task> getSubtasks(String parentTaskId) {
        TaskQuery query = TaskQuery.builder()
                .parentId(parentTaskId)
                .build();
        return findTasks(query);
    }
    public Duration getAccumulatedTime(String taskId) {
        Duration totalDuration = Duration.ZERO;
        List<Session> sessionList = sessionRepository.findAllByAssociatedTaskId(taskId);
        for (Session session : sessionList) {
            totalDuration = totalDuration.plus(session.getTotalSessionTime());
        }
        return totalDuration;
    }

    public Task createTask(NewTaskRequest request) {
        // Validate required field
        if (request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("Task name is required");
        }

        // Validate parent exists if this is a subtask
        if (request.getParentId() != null && !request.getParentId().isBlank()) {
            taskRepository.findTaskByTaskId(request.getParentId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Parent task not found: " + request.getParentId()
                    ));
        }

        Task task = new Task();
        task.setTaskId(UUID.randomUUID().toString());
        task.setName(request.getName());

        // Optional fields with null checks
        task.setDescription(request.getDescription()); // null is fine for description

        // Parse datetime only if provided
        if (request.getScheduledPerformDateTime() != null && !request.getScheduledPerformDateTime().isBlank()) {
            try {
                task.setScheduledPerformDateTime(LocalDateTime.parse(request.getScheduledPerformDateTime()));
            } catch (DateTimeParseException e) {
                throw new IllegalArgumentException("Invalid datetime format. Use ISO format: 2024-01-20T10:30:00", e);
            }
        } else {
            // Default to now if not provided
            task.setScheduledPerformDateTime(LocalDateTime.now());
        }

        task.setParentId(request.getParentId()); // null is fine for main tasks
        task.setTag(request.getTag()); // null is fine
        task.setImportance(request.getImportance()); // primitive int defaults to 0
        task.setCompleted(false);
        task.setCreationDateTime(LocalDateTime.now());

        return taskRepository.save(task);
    }

    public Optional<Task> updateTask(String taskId, UpdateTaskRequest request) {
        return taskRepository.findTaskByTaskId(taskId)
                .map(task -> {
                    if (request.getName() != null) {
                        task.setName(request.getName());
                    }
                    if (request.getDescription() != null) {
                        task.setDescription(request.getDescription());
                    }
                    if (request.getCompleted() != null) {
                        task.setCompleted(request.getCompleted());
                        if (request.getCompleted()) {
                            task.setCompletionDateTime(LocalDateTime.now());
                        }
                    }
                    if (request.getTag() != null) {
                        task.setTag(request.getTag());
                    }
                    if (request.getImportance() != null) {
                        task.setImportance(request.getImportance());
                    }
                    if (request.getScheduledPerformDateTime() != null) {
                        task.setScheduledPerformDateTime(request.getScheduledPerformDateTime());
                    }
                    return taskRepository.save(task);
                });
    }

    public void deleteTask(String taskId) {
        // Delete subtasks first
        TaskQuery subtaskQuery = TaskQuery.builder()
                .parentId(taskId)
                .build();
        List<Task> subtasks = findTasks(subtaskQuery);
        subtasks.forEach(subtask -> taskRepository.deleteTaskByTaskId(subtask.getTaskId()));

        // Delete main task
        taskRepository.deleteTaskByTaskId(taskId);
    }

    // Convenience methods for common queries
    public List<Task> getAllMainTasks() {
        return findTasks(TaskQuery.builder().build());
    }

    public List<Task> getTodayTasks() {
        return findTasks(TaskQuery.builder().period(TaskQuery.DatePeriod.TODAY).build());
    }

    public List<Task> getIncompleteTasks() {
        return findTasks(TaskQuery.builder().completed(false).build());
    }

    public Optional<Task> getHighestPriorityIncompleteTask() {
        TaskQuery query = TaskQuery.builder()
                .completed(false)
                .build();

        return findTasks(query).stream().findFirst(); // Already sorted by importance
    }

}
