package org.osama.task;


import org.osama.requests.UpdateTaskRequest;
import org.osama.requests.NewTaskRequest;
import org.osama.session.task.TaskSession;
import org.osama.session.task.TaskSessionRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
public class TaskService {
    private final TaskRepository taskRepository;
    private final TaskSessionRepository taskSessionRepository;
    private final UserRepository userRepository;

    public TaskService(TaskRepository taskRepository, TaskSessionRepository taskSessionRepository,
                       UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.taskSessionRepository = taskSessionRepository;
        this.userRepository = userRepository;
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
        List<TaskSession> taskSessionList = taskSessionRepository.findAllByAssociatedTaskId(taskId);
        for (TaskSession taskSession : taskSessionList) {
            totalDuration = totalDuration.plus(taskSession.getTotalSessionTime());
        }
        return totalDuration;
    }

    public Task createTask(NewTaskRequest request, String userId) {
        // Validate required field
        if (request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("Task name is required");
        }

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

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
        task.setUser(user);

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
    public List<Task> getAllMainTasks(String userId) {
        return findTasks(TaskQuery.builder().userId(userId).build());
    }

    public List<Task> getTodayTasks(String userId) {
        return findTasks(TaskQuery.builder().period(TaskQuery.DatePeriod.TODAY).userId(userId).build());
    }

    public List<Task> getIncompleteTasks(String userId) {
        return findTasks(TaskQuery.builder().completed(false).userId(userId).build());
    }

    public Optional<Task> getHighestPriorityIncompleteTask(String userId) {
        TaskQuery query = TaskQuery.builder()
                .completed(false)
                .userId(userId)
                .build();

        return findTasks(query).stream().findFirst(); // Already sorted by importance
    }

}
