package org.osama.task;


import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
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
@Slf4j
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

    public Optional<Task> getTaskForUser(String taskId, String userId) {
        return taskRepository.findTaskByTaskIdAndUserId(taskId, userId);
    }

    public Task getTaskForUserOrThrow(String taskId, String userId) {
        return getTaskForUser(taskId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskId));
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
                log.warn("Task creation rejected because scheduledPerformDateTime is invalid: value={}",
                        request.getScheduledPerformDateTime(), e);
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

        Task savedTask = taskRepository.save(task);
        log.info("Task created: userId={} taskId={} parentTaskId={}",
                userId, savedTask.getTaskId(), savedTask.getParentId());
        return savedTask;
    }

    public Optional<Task> updateTask(String taskId, UpdateTaskRequest request) {
        Optional<Task> existingTask = taskRepository.findTaskByTaskId(taskId);
        if (existingTask.isEmpty()) {
            log.warn("Task update ignored: taskId={} was not found", taskId);
            return Optional.empty();
        }

        Task task = existingTask.get();
        List<String> changedFields = new ArrayList<>();
        if (request.getName() != null) {
            task.setName(request.getName());
            changedFields.add("name");
        }
        if (request.getDescription() != null) {
            task.setDescription(request.getDescription());
            changedFields.add("description");
        }
        if (request.getCompleted() != null) {
            task.setCompleted(request.getCompleted());
            changedFields.add("completed");
            if (request.getCompleted()) {
                task.setCompletionDateTime(LocalDateTime.now());
            }
        }
        if (request.getTag() != null) {
            task.setTag(request.getTag());
            changedFields.add("tag");
        }
        if (request.getImportance() != null) {
            task.setImportance(request.getImportance());
            changedFields.add("importance");
        }
        if (request.getScheduledPerformDateTime() != null) {
            task.setScheduledPerformDateTime(request.getScheduledPerformDateTime());
            changedFields.add("scheduledPerformDateTime");
        }

        Task savedTask = taskRepository.save(task);
        log.info("Task updated: userId={} taskId={} changedFields={}",
                task.getUserId(), savedTask.getTaskId(), changedFields);
        return Optional.of(savedTask);
    }

    public void deleteTask(String taskId) {
        Optional<Task> taskToDelete = taskRepository.findTaskByTaskId(taskId);
        if (taskToDelete.isEmpty()) {
            log.warn("Task deletion ignored: taskId={} was not found", taskId);
            return;
        }

        // Delete subtasks first
        TaskQuery subtaskQuery = TaskQuery.builder()
                .parentId(taskId)
                .build();
        List<Task> subtasks = findTasks(subtaskQuery);
        subtasks.forEach(subtask -> taskRepository.deleteTaskByTaskId(subtask.getTaskId()));

        // Delete main task
        taskRepository.deleteTaskByTaskId(taskId);
        log.info("Task deleted: userId={} taskId={} deletedSubtaskCount={}",
                taskToDelete.get().getUserId(), taskId, subtasks.size());
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
