package org.osama.task;


import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.mentalthread.MentalThread;
import org.osama.mentalthread.MentalThreadRepository;
import org.osama.mentalthread.MentalThreadStatus;
import org.osama.requests.UpdateTaskRequest;
import org.osama.requests.NewTaskRequest;
import org.osama.session.task.TaskSession;
import org.osama.session.task.TaskSessionRepository;
import org.osama.taskgroup.TaskGroupService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class TaskService {
    private final TaskRepository taskRepository;
    private final TaskSessionRepository taskSessionRepository;
    private final UserRepository userRepository;
    private final MentalThreadRepository mentalThreadRepository;
    private final TaskGroupService taskGroupService;

    public TaskService(TaskRepository taskRepository, TaskSessionRepository taskSessionRepository,
                       UserRepository userRepository, MentalThreadRepository mentalThreadRepository,
                       TaskGroupService taskGroupService) {
        this.taskRepository = taskRepository;
        this.taskSessionRepository = taskSessionRepository;
        this.userRepository = userRepository;
        this.mentalThreadRepository = mentalThreadRepository;
        this.taskGroupService = taskGroupService;
    }

    public List<Task> findTasks(TaskQuery query) {
        Specification<Task> spec = TaskSpecifications.matchesQuery(query);

        // Add sorting
        Sort sort = Sort.by(
                Sort.Order.asc("displayOrder"),
                Sort.Order.asc("completed"),
                Sort.Order.desc("importance"),
                Sort.Order.desc("creationDateTime"),
                Sort.Order.asc("taskId")
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

    public List<Task> getSubtasks(String parentTaskId, String userId) {
        TaskQuery query = TaskQuery.builder()
                .parentId(parentTaskId)
                .userId(userId)
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

    @Transactional
    public Task createTask(NewTaskRequest request, String userId) {
        // Validate required field
        if (request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("Task name is required");
        }

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        String requestedParentId = request.getParentId();
        String parentId = requestedParentId != null && requestedParentId.isBlank()
                ? null
                : requestedParentId;
        if (parentId != null) {
            String validatedParentId = parentId;
            taskRepository.findTaskByTaskIdAndUserId(validatedParentId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent task not found: " + validatedParentId));
        }

        String mentalThreadId = normalizeOptionalId(request.getMentalThreadId());
        MentalThread mentalThread = null;
        if (mentalThreadId != null) {
            mentalThread = mentalThreadRepository.findByIdAndUserId(mentalThreadId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("Mental thread not found: " + mentalThreadId));
            if (mentalThread.getStatus() != MentalThreadStatus.OPEN) {
                throw new IllegalArgumentException("Tasks can only be added to an open mental thread.");
            }
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

        task.setParentId(parentId); // null is fine for main tasks
        task.setTag(request.getTag()); // null is fine
        task.setImportance(request.getImportance()); // primitive int defaults to 0
        task.setDisplayOrder(nextDisplayOrder(userId, parentId));
        task.setMentalThreadId(mentalThreadId);
        task.setCompleted(false);
        task.setCreationDateTime(LocalDateTime.now());
        task.setUser(user);

        Task savedTask = taskRepository.save(task);
        if (mentalThread != null) {
            taskGroupService.addTaskToDefaultMentalThreadGroup(savedTask, mentalThread, userId);
        }
        log.info("Task created: userId={} taskId={} parentTaskId={} mentalThreadId={}",
                userId, savedTask.getTaskId(), savedTask.getParentId(), savedTask.getMentalThreadId());
        return savedTask;
    }

    public Optional<Task> updateTask(String taskId, UpdateTaskRequest request, String userId) {
        Optional<Task> existingTask = taskRepository.findTaskByTaskIdAndUserId(taskId, userId);
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

    @Transactional
    public void deleteTask(String taskId, String userId) {
        Optional<Task> taskToDelete = taskRepository.findTaskByTaskIdAndUserId(taskId, userId);
        if (taskToDelete.isEmpty()) {
            log.warn("Task deletion ignored: taskId={} was not found", taskId);
            return;
        }

        // Delete subtasks first
        TaskQuery subtaskQuery = TaskQuery.builder()
                .parentId(taskId)
                .userId(userId)
                .build();
        List<Task> subtasks = findTasks(subtaskQuery);
        List<String> deletedTaskIds = new ArrayList<>(subtasks.stream().map(Task::getTaskId).toList());
        deletedTaskIds.add(taskId);
        taskGroupService.removeTasksFromGroups(deletedTaskIds, userId);
        subtasks.forEach(subtask -> taskRepository.deleteTaskByTaskId(subtask.getTaskId()));

        // Delete main task
        taskRepository.deleteTaskByTaskId(taskId);
        log.info("Task deleted: userId={} taskId={} deletedSubtaskCount={}",
                userId, taskId, subtasks.size());
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

        Sort prioritySort = Sort.by(
                Sort.Order.asc("completed"),
                Sort.Order.desc("importance"),
                Sort.Order.desc("creationDateTime"),
                Sort.Order.asc("taskId")
        );
        return taskRepository.findAll(TaskSpecifications.matchesQuery(query), prioritySort)
                .stream()
                .findFirst();
    }

    @Transactional
    public List<Task> reorderMainTasks(List<String> taskIds, String userId) {
        if (taskIds == null || taskIds.stream().anyMatch(Objects::isNull)
                || taskIds.size() != taskIds.stream().distinct().count()) {
            throw new IllegalArgumentException("The task reorder list must contain unique task IDs.");
        }

        List<Task> allMainTasks = taskRepository.findAllByUserIdAndParentIdIsNullOrderByDisplayOrderAsc(userId);
        Map<String, Task> tasksById = allMainTasks.stream()
                .collect(Collectors.toMap(Task::getTaskId, task -> task));

        if (taskIds.stream().anyMatch(taskId -> !tasksById.containsKey(taskId))) {
            throw new IllegalArgumentException("The reorder list contains a task that does not belong to the user.");
        }

        List<Task> selectedTasks = taskIds.stream().map(tasksById::get).toList();
        List<Integer> selectedPositions = new ArrayList<>();
        for (int index = 0; index < allMainTasks.size(); index++) {
            if (taskIds.contains(allMainTasks.get(index).getTaskId())) {
                selectedPositions.add(index);
            }
        }
        for (int index = 0; index < selectedPositions.size(); index++) {
            allMainTasks.set(selectedPositions.get(index), selectedTasks.get(index));
        }
        for (int index = 0; index < allMainTasks.size(); index++) {
            allMainTasks.get(index).setDisplayOrder(index);
        }

        taskRepository.saveAll(allMainTasks);
        log.info("Tasks reordered: userId={} count={} orderedTaskIds={}", userId, taskIds.size(), taskIds);
        return allMainTasks;
    }

    private int nextDisplayOrder(String userId, String parentId) {
        Optional<Task> lastTask = parentId == null
                ? taskRepository.findTopByUserIdAndParentIdIsNullOrderByDisplayOrderDesc(userId)
                : taskRepository.findTopByUserIdAndParentIdOrderByDisplayOrderDesc(userId, parentId);
        return lastTask.map(task -> task.getDisplayOrder() + 1).orElse(0);
    }

    private String normalizeOptionalId(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

}
