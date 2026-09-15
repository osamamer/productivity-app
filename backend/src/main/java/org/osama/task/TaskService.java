package org.osama.task;


import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.mentalthread.MentalThread;
import org.osama.mentalthread.MentalThreadRepository;
import org.osama.mentalthread.MentalThreadStatus;
import org.osama.pomodoro.Pomodoro;
import org.osama.pomodoro.PomodoroRepository;
import org.osama.reminder.NotificationType;
import org.osama.reminder.Reminder;
import org.osama.reminder.ReminderRepository;
import org.osama.requests.UpdateTaskRequest;
import org.osama.requests.NewTaskRequest;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.session.task.TaskSession;
import org.osama.session.task.TaskSessionRepository;
import org.osama.stat.StatTaskLinkService;
import org.osama.taskgroup.TaskGroupService;
import org.osama.task.events.TasksDeletedEvent;
import org.osama.task.recurrence.TaskSeriesRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class TaskService {
    private static final int MAX_PAGED_TASK_LIMIT = 100;
    private static final int MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;

    private final TaskRepository taskRepository;
    private final TaskSessionRepository taskSessionRepository;
    private final UserRepository userRepository;
    private final MentalThreadRepository mentalThreadRepository;
    private final TaskGroupService taskGroupService;
    private final StatTaskLinkService statTaskLinkService;
    private final TaskSeriesRepository taskSeriesRepository;
    private final ReminderRepository reminderRepository;
    private final PomodoroRepository pomodoroRepository;
    private final ScheduledJobRepository scheduledJobRepository;
    private final ApplicationEventPublisher eventPublisher;

    public TaskService(TaskRepository taskRepository, TaskSessionRepository taskSessionRepository,
                       UserRepository userRepository, MentalThreadRepository mentalThreadRepository,
                       TaskGroupService taskGroupService, StatTaskLinkService statTaskLinkService,
                       TaskSeriesRepository taskSeriesRepository, ReminderRepository reminderRepository,
                       PomodoroRepository pomodoroRepository, ScheduledJobRepository scheduledJobRepository,
                       ApplicationEventPublisher eventPublisher) {
        this.taskRepository = taskRepository;
        this.taskSessionRepository = taskSessionRepository;
        this.userRepository = userRepository;
        this.mentalThreadRepository = mentalThreadRepository;
        this.taskGroupService = taskGroupService;
        this.statTaskLinkService = statTaskLinkService;
        this.taskSeriesRepository = taskSeriesRepository;
        this.reminderRepository = reminderRepository;
        this.pomodoroRepository = pomodoroRepository;
        this.scheduledJobRepository = scheduledJobRepository;
        this.eventPublisher = eventPublisher;
    }

    public List<Task> findTasks(TaskQuery query) {
        Specification<Task> spec = TaskSpecifications.matchesQuery(query);

        List<Task> tasks = taskRepository.findAll(spec, taskSort(query));
        attachReminderMinutes(tasks);
        return tasks;
    }

    public List<Task> findTasks(TaskQuery query, int limit, int offset) {
        if (limit < 1 || limit > MAX_PAGED_TASK_LIMIT) {
            throw new IllegalArgumentException("Task query limit must be between 1 and " + MAX_PAGED_TASK_LIMIT + ".");
        }
        if (offset < 0 || offset % limit != 0) {
            throw new IllegalArgumentException("Task query offset must be a non-negative multiple of the limit.");
        }

        Specification<Task> spec = TaskSpecifications.matchesQuery(query);
        List<Task> tasks = taskRepository.findAll(
                spec,
                PageRequest.of(offset / limit, limit, taskSort(query))
        ).getContent();
        attachReminderMinutes(tasks);
        return tasks;
    }

    private Sort taskSort(TaskQuery query) {
        if (query.getPeriod() == TaskQuery.DatePeriod.FUTURE) {
            return Sort.by(
                    Sort.Order.asc("scheduledPerformDateTime"),
                    Sort.Order.asc("completed"),
                    Sort.Order.desc("importance"),
                    Sort.Order.asc("taskId")
            );
        }
        if (query.getPeriod() == TaskQuery.DatePeriod.PAST) {
            return Sort.by(
                    Sort.Order.desc("scheduledPerformDateTime"),
                    Sort.Order.asc("completed"),
                    Sort.Order.desc("importance"),
                    Sort.Order.asc("taskId")
            );
        }
        return Sort.by(
                Sort.Order.asc("displayOrder"),
                Sort.Order.asc("completed"),
                Sort.Order.desc("importance"),
                Sort.Order.desc("creationDateTime"),
                Sort.Order.asc("taskId")
        );
    }

    public Optional<Task> getTask(String taskId) {
        return taskRepository.findTaskByTaskId(taskId)
                .filter(task -> !task.isSkipped())
                .map(this::attachReminderMinutes);
    }

    public Optional<Task> getTaskForUser(String taskId, String userId) {
        return taskRepository.findTaskByTaskIdAndUserId(taskId, userId)
                .filter(task -> !task.isSkipped())
                .map(this::attachReminderMinutes);
    }

    public Task getTaskForUserOrThrow(String taskId, String userId) {
        return getTaskForUser(taskId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskId));
    }

    public List<Task> getSubtasks(String parentTaskId, String userId) {
        List<Task> subtasks = taskRepository
                .findAllByUserIdAndParentIdOrderByDisplayOrderAscCreationDateTimeAscTaskIdAsc(userId, parentTaskId)
                .stream()
                .filter(task -> !task.isSkipped())
                .toList();
        attachReminderMinutes(subtasks);
        return subtasks;
    }

    @Transactional(readOnly = true)
    public TaskPomodoroStatsResponse getPomodoroStats(String taskId, String userId) {
        getTaskForUserOrThrow(taskId, userId);
        LocalDateTime now = LocalDateTime.now();
        return TaskPomodoroStatsCalculator.calculate(
                taskId,
                taskSessionRepository.findAllByAssociatedTaskId(taskId),
                now.toLocalDate(),
                now
        );
    }

    @Transactional(readOnly = true)
    public Map<LocalDate, Long> getPomodoroFocusTimeForSeries(String seriesId,
                                                               LocalDate from,
                                                               LocalDate to,
                                                               String userId) {
        List<Task> occurrences = taskRepository
                .findAllByTaskSeriesIdAndUserIdAndSeriesOccurrenceAtGreaterThanEqualAndSeriesOccurrenceAtLessThanOrderBySeriesOccurrenceAtAsc(
                        seriesId, userId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        if (occurrences.isEmpty()) return Map.of();

        Map<String, LocalDate> occurrenceDates = new HashMap<>();
        Map<LocalDate, Long> focusByDate = new TreeMap<>();
        for (Task occurrence : occurrences) {
            LocalDate occurrenceDate = occurrence.getSeriesOccurrenceAt().toLocalDate();
            occurrenceDates.put(occurrence.getTaskId(), occurrenceDate);
            focusByDate.putIfAbsent(occurrenceDate, 0L);
        }

        LocalDateTime now = LocalDateTime.now();
        taskSessionRepository.findAllByAssociatedTaskIdIn(occurrenceDates.keySet()).stream()
                .filter(TaskSession::isPomodoro)
                .forEach(session -> {
                    LocalDate occurrenceDate = occurrenceDates.get(session.getAssociatedTaskId());
                    if (occurrenceDate != null) {
                        focusByDate.merge(occurrenceDate,
                                TaskPomodoroStatsCalculator.focusSeconds(session, now), Long::sum);
                    }
                });

        return focusByDate;
    }

    @Transactional(readOnly = true)
    public Map<LocalDate, Long> getPomodoroFocusTimeForTaskName(String taskName,
                                                                 LocalDate from,
                                                                 LocalDate to,
                                                                 String userId,
                                                                 String excludedSeriesId) {
        return taskName == null
                ? Map.of()
                : getPomodoroFocusTimeForTaskNames(List.of(taskName), from, to, userId, excludedSeriesId);
    }

    public Map<LocalDate, Long> getPomodoroFocusTimeForTaskNames(Collection<String> taskNames,
                                                                  LocalDate from,
                                                                  LocalDate to,
                                                                  String userId,
                                                                  String excludedSeriesId) {
        if (taskNames == null || taskNames.isEmpty()) return Map.of();

        Set<String> taskIds = new HashSet<>();
        for (String taskName : taskNames) {
            if (taskName == null || taskName.isBlank()) continue;
            taskRepository.findAllByUserIdAndNameIgnoreCase(userId, taskName.trim()).stream()
                    .filter(task -> excludedSeriesId == null || !excludedSeriesId.equals(task.getTaskSeriesId()))
                    .map(Task::getTaskId)
                    .forEach(taskIds::add);
        }
        if (taskIds.isEmpty()) return Map.of();

        Map<LocalDate, Long> focusByDate = new TreeMap<>();
        LocalDateTime now = LocalDateTime.now();
        taskSessionRepository
                .findAllByAssociatedTaskIdInAndPomodoroIsTrueAndStartTimeGreaterThanEqualAndStartTimeLessThan(
                        taskIds, from.atStartOfDay(), to.plusDays(1).atStartOfDay())
                .forEach(session -> focusByDate.merge(
                        session.getStartTime().toLocalDate(),
                        TaskPomodoroStatsCalculator.focusSeconds(session, now),
                        Long::sum));
        return focusByDate;
    }

    @Transactional(readOnly = true)
    public TodayFocusSummaryResponse getTodayFocusSummary(String userId, LocalDate date) {
        List<String> taskIds = taskRepository.findAllByUserId(userId).stream()
                .map(Task::getTaskId)
                .toList();
        if (taskIds.isEmpty()) {
            return new TodayFocusSummaryResponse(date, 0);
        }

        LocalDateTime now = LocalDateTime.now();
        long totalFocusSeconds = taskSessionRepository.findAllByAssociatedTaskIdIn(taskIds).stream()
                .filter(TaskSession::isPomodoro)
                .filter(session -> session.getStartTime() != null
                        && date.equals(session.getStartTime().toLocalDate()))
                .mapToLong(session -> TaskPomodoroStatsCalculator.focusSeconds(session, now))
                .sum();

        return new TodayFocusSummaryResponse(date, totalFocusSeconds);
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
        return createTaskInternal(request, userId, false, true);
    }

    @Transactional
    public Task createTaskFromSeries(NewTaskRequest request, String userId) {
        return createTaskInternal(request, userId, true, false);
    }

    private Task createTaskInternal(NewTaskRequest request, String userId, boolean allowClosedMentalThread,
                                    boolean prependToTaskOrder) {
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
            if (!allowClosedMentalThread && mentalThread.getStatus() != MentalThreadStatus.OPEN) {
                throw new IllegalArgumentException("Tasks can only be added to an open mental thread.");
            }
        }

        Task task = new Task();
        task.setTaskId(UUID.randomUUID().toString());
        task.setName(request.getName());

        // Optional fields with null checks
        task.setDescription(request.getDescription()); // null is fine for description
        task.setTimeZone(normalizeTimeZone(request.getTimeZone()));

        // Thread next actions stay unscheduled until the user chooses a date.
        if (request.getScheduledPerformDateTime() != null && !request.getScheduledPerformDateTime().isBlank()) {
            try {
                task.setScheduledPerformDateTime(LocalDateTime.parse(request.getScheduledPerformDateTime()));
            } catch (DateTimeParseException e) {
                log.warn("Task creation rejected because scheduledPerformDateTime is invalid: value={}",
                        request.getScheduledPerformDateTime(), e);
                throw new IllegalArgumentException("Invalid datetime format. Use ISO format: 2024-01-20T10:30:00", e);
            }
        }

        task.setParentId(parentId); // null is fine for main tasks
        task.setTag(request.getTag()); // null is fine
        task.setImportance(request.getImportance()); // primitive int defaults to 0
        if (mentalThread == null) {
            if (prependToTaskOrder && parentId == null) {
                prependTaskOrder(userId, null);
                task.setDisplayOrder(0);
            } else {
                // Series expansion may create many rows in one request. Appending
                // avoids rewriting the full task order for every occurrence.
                task.setDisplayOrder(nextDisplayOrder(userId, parentId));
            }
        } else {
            task.setDisplayOrder(nextDisplayOrder(userId, parentId));
        }
        task.setMentalThreadId(mentalThreadId);
        task.setCompleted(false);
        task.setSkipped(false);
        task.setSkipReason(null);
        task.setCreationDateTime(LocalDateTime.now());
        task.setUser(user);

        Task savedTask = taskRepository.save(task);
        replaceTaskReminder(savedTask, requestedReminderMinutes(request), user);
        if (mentalThread != null) {
            taskGroupService.addTaskToDefaultMentalThreadGroup(savedTask, mentalThread, userId);
        }
        log.info("Task created: userId={} taskId={} parentTaskId={} mentalThreadId={}",
                userId, savedTask.getTaskId(), savedTask.getParentId(), savedTask.getMentalThreadId());
        return savedTask;
    }

    @Transactional
    public Optional<Task> updateTask(String taskId, UpdateTaskRequest request, String userId) {
        Optional<Task> existingTask = taskRepository.findTaskByTaskIdAndUserId(taskId, userId)
                .filter(task -> !task.isSkipped());
        if (existingTask.isEmpty()) {
            log.warn("Task update ignored: taskId={} was not found", taskId);
            return Optional.empty();
        }

        Task task = existingTask.get();
        Optional<Reminder> existingReminder = findTaskReminder(taskId);
        LocalDate previousTaskDate = taskDate(task);
        boolean scheduleChanged = request.getScheduledPerformDateTime() != null;
        boolean timeZoneChanged = request.getTimeZone() != null;
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
            } else {
                task.setCompletionDateTime(null);
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
            String requestedDateTime = request.getScheduledPerformDateTime().trim();
            if (requestedDateTime.isBlank()) {
                task.setScheduledPerformDateTime(null);
            } else {
                try {
                    task.setScheduledPerformDateTime(LocalDateTime.parse(requestedDateTime));
                } catch (DateTimeParseException e) {
                    log.warn("Task update rejected because scheduledPerformDateTime is invalid: taskId={} value={}",
                            taskId, requestedDateTime, e);
                    throw new IllegalArgumentException(
                            "Invalid datetime format. Use ISO format: 2024-01-20T10:30:00", e);
                }
            }
            changedFields.add("scheduledPerformDateTime");
        }
        if (request.getTimeZone() != null) {
            task.setTimeZone(normalizeTimeZone(request.getTimeZone()));
            changedFields.add("timeZone");
        }

        Task savedTask = taskRepository.save(task);
        if (request.isReminderMinutesBeforePresent() || scheduleChanged || timeZoneChanged) {
            Integer minutesBefore = request.isReminderMinutesBeforePresent()
                    ? requestedReminderMinutes(request.getReminderMinutesBefore())
                    : existingReminder.map(Reminder::getMinutesBefore).orElse(null);
            replaceTaskReminder(savedTask, minutesBefore, task.getUser());
        } else if (existingReminder.isPresent() && request.getName() != null) {
            Reminder reminder = existingReminder.get();
            reminder.setTitle(savedTask.getName());
            reminderRepository.save(reminder);
            savedTask.setReminderMinutesBefore(reminder.getMinutesBefore());
        } else {
            savedTask.setReminderMinutesBefore(existingReminder.map(Reminder::getMinutesBefore).orElse(null));
        }
        if (scheduleChanged) {
            statTaskLinkService.synchronizeTaskSchedule(savedTask, previousTaskDate, userId);
        }
        if (request.getCompleted() != null || (scheduleChanged && savedTask.isCompleted())) {
            // Schedule migration happens before this state write so a
            // completion change in the same request wins at the new date.
            statTaskLinkService.synchronizeTaskCompletion(savedTask, userId);
        }
        savedTask.setStatLinked(statTaskLinkService.isStatLinkedTask(savedTask, userId));
        log.info("Task updated: userId={} taskId={} changedFields={}",
                task.getUserId(), savedTask.getTaskId(), changedFields);
        return Optional.of(savedTask);
    }

    private Integer requestedReminderMinutes(NewTaskRequest request) {
        if (!request.isReminderMinutesBeforePresent()) return null;
        return requestedReminderMinutes(request.getReminderMinutesBefore());
    }

    private Integer requestedReminderMinutes(Integer minutesBefore) {
        if (minutesBefore != null && (minutesBefore < 0 || minutesBefore > MAX_REMINDER_MINUTES)) {
            throw new IllegalArgumentException("Reminder must be between the task time and eight weeks before it.");
        }
        return minutesBefore;
    }

    private void replaceTaskReminder(Task task, Integer minutesBefore, User user) {
        reminderRepository.findByTaskIdAndNotificationType(task.getTaskId(), NotificationType.TASK_REMINDER)
                .ifPresent(reminder -> {
                    reminderRepository.delete(reminder);
                    reminderRepository.flush();
                });

        if (minutesBefore == null || task.getScheduledPerformDateTime() == null) {
            task.setReminderMinutesBefore(null);
            return;
        }

        Reminder reminder = new Reminder();
        reminder.setReminderId(UUID.randomUUID().toString());
        reminder.setTaskId(task.getTaskId());
        reminder.setDateTime(task.getScheduledPerformDateTime()
                .atZone(ZoneId.of(normalizeTimeZone(task.getTimeZone())))
                .toInstant()
                .minusSeconds(minutesBefore.longValue() * 60));
        reminder.setRepeat(0);
        reminder.setNotificationType(NotificationType.TASK_REMINDER);
        reminder.setTitle(task.getName());
        reminder.setBody("Task reminder");
        reminder.setTargetUrl("/tasks");
        reminder.setMinutesBefore(minutesBefore);
        reminder.setUser(user);
        reminderRepository.save(reminder);
        task.setReminderMinutesBefore(minutesBefore);
    }

    private Optional<Reminder> findTaskReminder(String taskId) {
        return reminderRepository.findByTaskIdAndNotificationType(taskId, NotificationType.TASK_REMINDER);
    }

    private Task attachReminderMinutes(Task task) {
        task.setReminderMinutesBefore(findTaskReminder(task.getTaskId())
                .map(Reminder::getMinutesBefore)
                .orElse(null));
        return task;
    }

    private void attachReminderMinutes(List<Task> tasks) {
        if (tasks.isEmpty()) return;
        Map<String, Integer> reminderMinutes = reminderRepository
                .findAllByTaskIdInAndNotificationType(
                        tasks.stream().map(Task::getTaskId).toList(), NotificationType.TASK_REMINDER)
                .stream()
                .collect(Collectors.toMap(Reminder::getTaskId, Reminder::getMinutesBefore, (first, ignored) -> first));
        tasks.forEach(task -> task.setReminderMinutesBefore(reminderMinutes.get(task.getTaskId())));
    }

    private String normalizeTimeZone(String timeZone) {
        String normalized = timeZone == null || timeZone.isBlank() ? "UTC" : timeZone.trim();
        try {
            ZoneId.of(normalized);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("Task time zone is invalid.", exception);
        }
        return normalized;
    }

    @Transactional
    public void deleteTask(String taskId, String userId) {
        Optional<Task> taskToDelete = taskRepository.findTaskByTaskIdAndUserId(taskId, userId);
        if (taskToDelete.isEmpty()) {
            log.warn("Task deletion ignored: taskId={} was not found", taskId);
            return;
        }

        if (taskToDelete.get().getTaskSeriesId() != null) {
            deleteRecurringSeriesCompletely(taskToDelete.get().getTaskSeriesId(), userId);
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
        deleteTaskReminders(deletedTaskIds);
        deleteTaskRuntimeState(deletedTaskIds);
        subtasks.forEach(subtask -> taskRepository.deleteTaskByTaskId(subtask.getTaskId()));

        // Delete main task
        taskRepository.deleteTaskByTaskId(taskId);
        log.info("Task deleted: userId={} taskId={} deletedSubtaskCount={}",
                userId, taskId, subtasks.size());
    }

    @Transactional
    public void deleteTaskOccurrence(String taskId, String userId) {
        Task task = taskRepository.findTaskByTaskIdAndUserId(taskId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskId));
        if (task.getTaskSeriesId() == null) {
            throw new IllegalArgumentException("Only a recurring task has individual occurrences.");
        }

        List<Task> subtasks = taskRepository.findAllByUserIdAndParentIdOrderByDisplayOrderAsc(userId, taskId);
        List<String> deletedTaskIds = new ArrayList<>(subtasks.stream().map(Task::getTaskId).toList());
        deletedTaskIds.add(taskId);
        taskGroupService.removeTasksFromGroups(deletedTaskIds, userId);
        deleteTaskReminders(deletedTaskIds);
        deleteTaskRuntimeState(subtasks.stream().map(Task::getTaskId).toList());
        clearActiveTaskRuntimeState(List.of(taskId));
        taskRepository.deleteAll(subtasks);

        task.setSkipped(true);
        task.setSkipReason(TaskSkipReason.USER);
        taskRepository.save(task);
        log.info("Recurring task occurrence deleted: userId={} taskId={} seriesId={} deletedSubtaskCount={}",
                userId, taskId, task.getTaskSeriesId(), subtasks.size());
    }

    @Transactional
    public void deleteRecurringSeriesCompletely(String seriesId, String userId) {
        taskSeriesRepository.findBySeriesIdAndUserId(seriesId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task series not found: " + seriesId));
        List<Task> occurrences = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(seriesId);
        List<String> deletedTaskIds = new ArrayList<>(occurrences.stream().map(Task::getTaskId).toList());
        List<Task> subtasks = occurrences.stream()
                .flatMap(task -> taskRepository.findAllByUserIdAndParentIdOrderByDisplayOrderAsc(userId, task.getTaskId()).stream())
                .toList();
        deletedTaskIds.addAll(subtasks.stream().map(Task::getTaskId).toList());

        taskGroupService.removeTasksFromGroups(deletedTaskIds, userId);
        deleteTaskReminders(deletedTaskIds);
        deleteTaskRuntimeState(deletedTaskIds);
        taskRepository.deleteAll(subtasks);
        taskRepository.deleteAll(occurrences);
        taskSeriesRepository.deleteById(seriesId);
        log.info("Recurring task series permanently deleted: userId={} seriesId={} occurrenceCount={}",
                userId, seriesId, occurrences.size());
    }

    /**
     * Deletes every task scheduled after today, including completed and skipped tasks.
     * Recurring series are deactivated so their deleted future occurrences cannot return.
     */
    @Transactional
    public int deleteAllFutureTasks(String userId) {
        LocalDateTime futureBoundary = LocalDate.now().plusDays(1).atStartOfDay();
        List<Task> scheduledFutureTasks = taskRepository
                .findAllByUserIdAndScheduledPerformDateTimeGreaterThanEqualOrderByScheduledPerformDateTimeAsc(
                        userId, futureBoundary);
        if (scheduledFutureTasks.isEmpty()) {
            return 0;
        }

        Map<String, Task> tasksToDelete = new LinkedHashMap<>();
        ArrayDeque<String> taskIdsToExpand = new ArrayDeque<>();
        scheduledFutureTasks.forEach(task -> {
            tasksToDelete.put(task.getTaskId(), task);
            taskIdsToExpand.add(task.getTaskId());
        });

        while (!taskIdsToExpand.isEmpty()) {
            String parentId = taskIdsToExpand.removeFirst();
            taskRepository.findAllByUserIdAndParentIdOrderByDisplayOrderAsc(userId, parentId)
                    .forEach(subtask -> {
                        if (tasksToDelete.putIfAbsent(subtask.getTaskId(), subtask) == null) {
                            taskIdsToExpand.addLast(subtask.getTaskId());
                        }
                    });
        }

        taskGroupService.removeTasksFromGroups(tasksToDelete.keySet(), userId);
        deleteTaskReminders(tasksToDelete.keySet());
        deleteTaskRuntimeState(tasksToDelete.keySet());

        tasksToDelete.values().stream()
                .map(Task::getTaskSeriesId)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(seriesId -> taskSeriesRepository.findBySeriesIdAndUserId(seriesId, userId)
                        .ifPresent(series -> {
                            series.setActive(false);
                            taskSeriesRepository.save(series);
                        }));

        List<Task> deletionOrder = new ArrayList<>(tasksToDelete.values());
        Collections.reverse(deletionOrder);
        deletionOrder.forEach(task -> taskRepository.deleteTaskByTaskId(task.getTaskId()));

        log.info("Future tasks deleted: userId={} futureBoundary={} taskCount={}",
                userId, futureBoundary, deletionOrder.size());
        return deletionOrder.size();
    }

    private void deleteTaskReminders(Collection<String> taskIds) {
        taskIds.forEach(reminderRepository::deleteByTaskId);
        reminderRepository.flush();
    }

    private void deleteTaskRuntimeState(Collection<String> taskIds) {
        List<String> distinctTaskIds = taskIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (distinctTaskIds.isEmpty()) return;

        List<TaskSession> taskSessions = taskSessionRepository.findAllByAssociatedTaskIdIn(distinctTaskIds);
        taskSessionRepository.deleteAll(taskSessions);
        taskSessionRepository.flush();

        List<ScheduledJob> scheduledJobs = scheduledJobRepository.findAllByAssociatedTaskIdIn(distinctTaskIds);
        scheduledJobRepository.deleteAll(scheduledJobs);
        scheduledJobRepository.flush();

        List<Pomodoro> pomodoros = pomodoroRepository.findAllByAssociatedTaskIdIn(distinctTaskIds);
        pomodoroRepository.deleteAll(pomodoros);
        pomodoroRepository.flush();

        eventPublisher.publishEvent(new TasksDeletedEvent(distinctTaskIds));
        log.info("Task runtime state deleted: taskCount={} sessionCount={} scheduledJobCount={} pomodoroCount={}",
                distinctTaskIds.size(), taskSessions.size(), scheduledJobs.size(), pomodoros.size());
    }

    private void clearActiveTaskRuntimeState(Collection<String> taskIds) {
        List<String> distinctTaskIds = taskIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (distinctTaskIds.isEmpty()) return;

        List<TaskSession> activeTaskSessions = taskSessionRepository
                .findAllByAssociatedTaskIdInAndActiveIsTrue(distinctTaskIds);
        taskSessionRepository.deleteAll(activeTaskSessions);
        taskSessionRepository.flush();

        List<ScheduledJob> scheduledJobs = scheduledJobRepository.findAllByAssociatedTaskIdIn(distinctTaskIds);
        scheduledJobRepository.deleteAll(scheduledJobs);
        scheduledJobRepository.flush();

        List<Pomodoro> activePomodoros = pomodoroRepository
                .findAllByAssociatedTaskIdInAndIsActiveIsTrue(distinctTaskIds);
        pomodoroRepository.deleteAll(activePomodoros);
        pomodoroRepository.flush();

        eventPublisher.publishEvent(new TasksDeletedEvent(distinctTaskIds));
        log.info("Active task runtime state cleared: taskCount={} sessionCount={} scheduledJobCount={} pomodoroCount={}",
                distinctTaskIds.size(), activeTaskSessions.size(), scheduledJobs.size(), activePomodoros.size());
    }

    // Convenience methods for common queries
    public List<Task> getAllMainTasks(String userId) {
        return findTasks(TaskQuery.builder().userId(userId).build());
    }

    public List<Task> getTodayTasks(String userId) {
        return findTasks(TaskQuery.builder().period(TaskQuery.DatePeriod.TODAY).userId(userId).build());
    }

    public List<Task> getUndatedTasks(String userId) {
        return findTasks(TaskQuery.builder().scheduled(false).userId(userId).build());
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
                .map(this::attachReminderMinutes)
                .findFirst();
    }

    @Transactional
    public List<Task> reorderMainTasks(List<String> taskIds, String userId) {
        if (taskIds == null || taskIds.stream().anyMatch(Objects::isNull)
                || taskIds.size() != taskIds.stream().distinct().count()) {
            throw new IllegalArgumentException("The task reorder list must contain unique task IDs.");
        }

        List<Task> allMainTasks = getAllMainTasks(userId);
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

    public void prependSeriesOccurrences(List<Task> newOccurrences, String userId) {
        if (newOccurrences.isEmpty()) return;

        Set<String> newOccurrenceIds = newOccurrences.stream()
                .map(Task::getTaskId)
                .collect(Collectors.toSet());
        List<Task> mainTasks = taskRepository.findAllByUserIdAndParentIdIsNullOrderByDisplayOrderAsc(userId);
        mainTasks.stream()
                .filter(task -> !newOccurrenceIds.contains(task.getTaskId()))
                .forEach(task -> task.setDisplayOrder(task.getDisplayOrder() + newOccurrences.size()));
        for (int index = 0; index < newOccurrences.size(); index++) {
            newOccurrences.get(index).setDisplayOrder(newOccurrences.size() - index - 1);
        }
        taskRepository.saveAll(mainTasks);
    }

    private void prependTaskOrder(String userId, String parentId) {
        List<Task> siblingTasks = parentId == null
                ? taskRepository.findAllByUserIdAndParentIdIsNullOrderByDisplayOrderAsc(userId)
                : taskRepository.findAllByUserIdAndParentIdOrderByDisplayOrderAsc(userId, parentId);
        siblingTasks.forEach(task -> task.setDisplayOrder(task.getDisplayOrder() + 1));
        if (!siblingTasks.isEmpty()) {
            taskRepository.saveAll(siblingTasks);
        }
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

    private LocalDate taskDate(Task task) {
        if (task.getScheduledPerformDateTime() != null) {
            return task.getScheduledPerformDateTime().toLocalDate();
        }
        return task.getSeriesOccurrenceAt() == null ? null : task.getSeriesOccurrenceAt().toLocalDate();
    }

}
