package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.requests.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.osama.task.recurrence.TaskRecurrenceFrequency;
import org.osama.task.recurrence.TaskRecurrenceUnit;
import org.osama.task.recurrence.TaskSeriesResponse;
import org.osama.task.recurrence.TaskSeriesUpdateRequest;
import org.osama.task.recurrence.TaskSeriesService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@Slf4j
public class StatService {

    private static final int MAX_STAT_TASK_SCHEDULE_WEEKS = 104;

    private final StatDefinitionRepository definitionRepository;
    private final StatFocusTaskLinkRepository focusTaskLinkRepository;
    private final StatEntryRepository entryRepository;
    private final UserRepository userRepository;
    private final StatGroupService statGroupService;
    private final TaskSeriesService taskSeriesService;
    private final StatTaskLinkService statTaskLinkService;
    private final TaskService taskService;
    private final TaskRepository taskRepository;

    public StatService(StatDefinitionRepository definitionRepository,
                       StatFocusTaskLinkRepository focusTaskLinkRepository,
                       StatEntryRepository entryRepository,
                       UserRepository userRepository,
                       StatGroupService statGroupService,
                       TaskSeriesService taskSeriesService,
                       StatTaskLinkService statTaskLinkService,
                       TaskService taskService,
                       TaskRepository taskRepository) {
        this.definitionRepository = definitionRepository;
        this.focusTaskLinkRepository = focusTaskLinkRepository;
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
        this.statGroupService = statGroupService;
        this.taskSeriesService = taskSeriesService;
        this.statTaskLinkService = statTaskLinkService;
        this.taskService = taskService;
        this.taskRepository = taskRepository;
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue, String userId) {
        return createDefinition(name, description, type, minValue, maxValue,
                null, null, false, userId);
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           String userId) {
        return createDefinition(name, description, type, minValue, maxValue,
                morality, goodThreshold, false, userId);
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           boolean createRecurringTask, String userId) {
        return createDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                createRecurringTask, TaskRecurrenceFrequency.DAILY, null, userId);
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           boolean createRecurringTask,
                                           TaskRecurrenceFrequency recurrenceFrequency,
                                           List<DayOfWeek> recurrenceDaysOfWeek,
                                           String userId) {
        return createDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                createRecurringTask, recurrenceFrequency, recurrenceDaysOfWeek, null, userId);
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           boolean createRecurringTask,
                                           TaskRecurrenceFrequency recurrenceFrequency,
                                           List<DayOfWeek> recurrenceDaysOfWeek,
                                           String requestedTimeOfDay,
                                           String userId) {
        return createDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                createRecurringTask, recurrenceFrequency, recurrenceDaysOfWeek, requestedTimeOfDay,
                null, userId);
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           boolean createRecurringTask,
                                           TaskRecurrenceFrequency recurrenceFrequency,
                                           List<DayOfWeek> recurrenceDaysOfWeek,
                                           String requestedTimeOfDay,
                                           Integer recurringTaskImportance,
                                           String userId) {
        return createDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                createRecurringTask, recurrenceFrequency, recurrenceDaysOfWeek, requestedTimeOfDay,
                recurringTaskImportance, List.of(), userId);
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           boolean createRecurringTask,
                                           TaskRecurrenceFrequency recurrenceFrequency,
                                           List<DayOfWeek> recurrenceDaysOfWeek,
                                           String requestedTimeOfDay,
                                           Integer recurringTaskImportance,
                                           List<StatType> additionalInputTypes,
                                           String userId) {
        return createDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                createRecurringTask, recurrenceFrequency, recurrenceDaysOfWeek, requestedTimeOfDay,
                recurringTaskImportance, additionalInputTypes, null, userId);
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           boolean createRecurringTask,
                                           TaskRecurrenceFrequency recurrenceFrequency,
                                           List<DayOfWeek> recurrenceDaysOfWeek,
                                           String requestedTimeOfDay,
                                           Integer recurringTaskImportance,
                                           List<StatType> additionalInputTypes,
                                           String unit,
                                           String userId) {
        return createDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                createRecurringTask, recurrenceFrequency, recurrenceDaysOfWeek, requestedTimeOfDay,
                recurringTaskImportance, additionalInputTypes, unit, null, userId);
    }

    @Transactional
    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           boolean createRecurringTask,
                                           TaskRecurrenceFrequency recurrenceFrequency,
                                           List<DayOfWeek> recurrenceDaysOfWeek,
                                           String requestedTimeOfDay,
                                           Integer recurringTaskImportance,
                                           List<StatType> additionalInputTypes,
                                           String unit,
                                           String parentDefinitionId,
                                           String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        String normalizedName = normalizeName(name);
        validateDefinition(normalizedName, type, minValue, maxValue, morality, goodThreshold, userId, null);
        StatDefinition parentDefinition = resolveParentDefinition(parentDefinitionId, userId, null);
        List<StatType> normalizedAdditionalTypes = normalizeAdditionalInputTypes(type, additionalInputTypes);
        String normalizedUnit = normalizeUnit(unit);
        validateUnit(type, normalizedAdditionalTypes, normalizedUnit);
        StatDefinition definition = saveDefinition(normalizedName, description, type, minValue, maxValue,
                morality, goodThreshold, null, user, normalizedAdditionalTypes, normalizedUnit,
                parentDefinition);
        return createRecurringTask
                ? createRecurringTask(definition.getId(), userId, null, recurrenceFrequency,
                recurrenceDaysOfWeek, requestedTimeOfDay, recurringTaskImportance)
                : definition;
    }

    @Transactional
    public StatDefinition updateDefinition(String definitionId, String name, String description,
                                           StatMorality morality, Double goodThreshold,
                                           String userId) {
        return updateDefinition(definitionId, name, description, morality, goodThreshold, null, userId);
    }

    @Transactional
    public StatDefinition updateDefinition(String definitionId, String name, String description,
                                           StatMorality morality, Double goodThreshold,
                                           List<StatType> requestedAdditionalInputTypes,
                                           String userId) {
        return updateDefinition(definitionId, name, description, morality, goodThreshold,
                requestedAdditionalInputTypes, null, userId);
    }

    @Transactional
    public StatDefinition updateDefinition(String definitionId, String name, String description,
                                           StatMorality morality, Double goodThreshold,
                                           List<StatType> requestedAdditionalInputTypes,
                                           String unit,
                                           String userId) {
        return updateDefinition(definitionId, name, description, morality, goodThreshold,
                requestedAdditionalInputTypes, unit, null, false, userId);
    }

    @Transactional
    public StatDefinition updateDefinition(String definitionId, String name, String description,
                                           StatMorality morality, Double goodThreshold,
                                           List<StatType> requestedAdditionalInputTypes,
                                           String unit,
                                           String requestedParentDefinitionId,
                                           boolean parentDefinitionIdProvided,
                                           String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (definition.getSystemKey() != null
                && !SystemStatCatalog.isUserEditableSystemKey(definition.getSystemKey())) {
            throw new IllegalArgumentException("Cannot edit a system stat.");
        }

        String normalizedName = normalizeName(name);
        validateDefinition(normalizedName, definition.getType(), definition.getMinValue(),
                definition.getMaxValue(), morality, goodThreshold, userId, definitionId);
        if (requestedAdditionalInputTypes != null) {
            definition.setAdditionalInputTypes(
                    normalizeAdditionalInputTypes(definition.getType(), requestedAdditionalInputTypes));
        }
        String normalizedUnit = normalizeUnit(unit);
        List<StatType> effectiveAdditionalTypes = definition.getAdditionalInputTypes();
        boolean supportsUnit = definition.getType() == StatType.NUMBER
                || effectiveAdditionalTypes.contains(StatType.NUMBER);
        validateUnit(definition.getType(), effectiveAdditionalTypes, normalizedUnit);
        if (unit != null || !supportsUnit) definition.setUnit(normalizedUnit);
        if (parentDefinitionIdProvided) {
            String normalizedParentId = normalizeParentId(requestedParentDefinitionId);
            if (!Objects.equals(definition.getParentDefinitionId(), normalizedParentId)) {
                definition.setParentDefinition(resolveParentDefinition(
                        normalizedParentId, userId, definitionId));
            }
        }
        boolean nameChanged = !normalizedName.equals(definition.getName());
        TaskSeriesResponse linkedSeries = nameChanged && definition.getRecurringTaskSeriesId() != null
                ? taskSeriesService.getSeries(definition.getRecurringTaskSeriesId(), userId)
                : null;
        if (linkedSeries != null) {
            renameRecurringFocusTaskLink(definition, linkedSeries.name(), normalizedName);
        }
        definition.setName(normalizedName);
        definition.setDescription(description);
        definition.setMorality(morality);
        definition.setGoodThreshold(goodThreshold);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        if (linkedSeries != null) {
            taskSeriesService.renameSeries(linkedSeries.seriesId(), normalizedName, userId);
        }
        log.info("Stat definition updated: userId={} statDefinitionId={} name={} morality={} goodThreshold={}",
                userId, savedDefinition.getId(), savedDefinition.getName(),
                savedDefinition.getMorality(), savedDefinition.getGoodThreshold());
        return withFocusTaskNames(savedDefinition);
    }

    @Transactional
    public StatDefinition updateStatsPageVisibility(String definitionId, boolean showOnStatsPage,
                                                    String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (!SystemStatCatalog.MEDITATED_SYSTEM_KEY.equals(definition.getSystemKey())) {
            throw new IllegalArgumentException("Stats page visibility is only configurable for Meditate.");
        }
        definition.setShowOnStatsPage(showOnStatsPage);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Stat page visibility updated: userId={} statDefinitionId={} showOnStatsPage={}",
                userId, savedDefinition.getId(), savedDefinition.isShowOnStatsPage());
        return withFocusTaskNames(savedDefinition);
    }

    @Transactional
    public StatDefinition createRecurringTask(String definitionId, String userId) {
        return createRecurringTask(definitionId, userId, null, TaskRecurrenceFrequency.DAILY, null);
    }

    @Transactional
    public StatDefinition createRecurringTask(String definitionId, String userId, String requestedTimeZone) {
        return createRecurringTask(definitionId, userId, requestedTimeZone,
                TaskRecurrenceFrequency.DAILY, null);
    }

    @Transactional
    public StatDefinition createRecurringTask(String definitionId, String userId, String requestedTimeZone,
                                              TaskRecurrenceFrequency recurrenceFrequency,
                                              List<DayOfWeek> recurrenceDaysOfWeek) {
        return createRecurringTask(definitionId, userId, requestedTimeZone, recurrenceFrequency,
                recurrenceDaysOfWeek, null);
    }

    @Transactional
    public StatDefinition createRecurringTask(String definitionId, String userId, String requestedTimeZone,
                                              TaskRecurrenceFrequency recurrenceFrequency,
                                              List<DayOfWeek> recurrenceDaysOfWeek,
                                              String requestedTimeOfDay) {
        return createRecurringTask(definitionId, userId, requestedTimeZone, recurrenceFrequency,
                recurrenceDaysOfWeek, requestedTimeOfDay, null);
    }

    @Transactional
    public StatDefinition createRecurringTask(String definitionId, String userId, String requestedTimeZone,
                                              TaskRecurrenceFrequency recurrenceFrequency,
                                              List<DayOfWeek> recurrenceDaysOfWeek,
                                              String requestedTimeOfDay,
                                              Integer requestedImportance) {
        return createRecurringTask(definitionId, userId, requestedTimeZone, recurrenceFrequency,
                recurrenceDaysOfWeek, requestedTimeOfDay, requestedImportance, null);
    }

    @Transactional
    public StatDefinition createRecurringTask(String definitionId, String userId, String requestedTimeZone,
                                              TaskRecurrenceFrequency recurrenceFrequency,
                                              List<DayOfWeek> recurrenceDaysOfWeek,
                                              String requestedTimeOfDay,
                                              Integer requestedImportance,
                                              String requestedTaskName) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (definition.getType() != StatType.BOOLEAN) {
            throw new IllegalArgumentException("Only boolean statistics can have a recurring task.");
        }
        if (definition.getRecurringTaskSeriesId() != null) {
            throw new IllegalArgumentException("This statistic already has a recurring task.");
        }

        ZoneId timeZone;
        try {
            timeZone = requestedTimeZone == null || requestedTimeZone.isBlank()
                    ? ZoneId.systemDefault()
                    : ZoneId.of(requestedTimeZone);
        } catch (java.time.DateTimeException exception) {
            throw new IllegalArgumentException("The task time zone is invalid.", exception);
        }
        LocalDateTime now = LocalDateTime.now(timeZone).withSecond(0).withNano(0);
        TaskRecurrenceFrequency frequency = recurrenceFrequency == null
                ? TaskRecurrenceFrequency.DAILY : recurrenceFrequency;
        LocalTime timeOfDay = resolveTimeOfDay(requestedTimeOfDay, now.toLocalTime());
        LocalDateTime start = now.toLocalDate().atTime(timeOfDay);
        if (frequency == TaskRecurrenceFrequency.CUSTOM
                && (recurrenceDaysOfWeek == null || recurrenceDaysOfWeek.isEmpty())) {
            throw new IllegalArgumentException("A custom stat task needs at least one day of the week.");
        }
        if (frequency == TaskRecurrenceFrequency.CUSTOM) {
            while (!recurrenceDaysOfWeek.contains(start.getDayOfWeek())) {
                start = start.plusDays(1);
            }
        }
        String taskName = normalizeName(requestedTaskName);
        if (taskName == null || taskName.isBlank()) taskName = definition.getName();
        validateFocusTaskName(taskName);
        deleteUpcomingStatWeeklyTasks(definition, now, userId);
        NewTaskRequest request = new NewTaskRequest();
        request.setName(taskName);
        request.setScheduledPerformDateTime(start.toString());
        request.setRecurrenceFrequency(frequency);
        request.setRecurrenceDaysOfWeek(frequency == TaskRecurrenceFrequency.CUSTOM
                ? recurrenceDaysOfWeek : null);
        if (frequency == TaskRecurrenceFrequency.CUSTOM) {
            request.setRecurrenceInterval(1);
            request.setRecurrenceUnit(TaskRecurrenceUnit.WEEKS);
        }
        request.setTimeZone(timeZone.getId());
        request.setImportance(resolveTaskImportance(requestedImportance));

        Task firstOccurrence = taskSeriesService.createSeries(request, userId);
        definition.setRecurringTaskSeriesId(firstOccurrence.getTaskSeriesId());
        linkFocusTaskInternal(definition, taskName);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        statTaskLinkService.synchronizeExistingEntries(savedDefinition, userId);
        log.info("Recurring task linked to boolean stat: userId={} statDefinitionId={} seriesId={}",
                userId, savedDefinition.getId(), savedDefinition.getRecurringTaskSeriesId());
        return withFocusTaskNames(savedDefinition);
    }

    @Transactional(readOnly = true)
    public TaskSeriesResponse getRecurringTask(String definitionId, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (definition.getRecurringTaskSeriesId() == null) {
            throw new ResourceNotFoundException("This statistic has no recurring task.");
        }
        return taskSeriesService.getSeries(definition.getRecurringTaskSeriesId(), userId);
    }

    @Transactional(readOnly = true)
    public StatWeeklyTaskScheduleResponse getWeeklyTaskSchedule(String definitionId,
                                                                 String requestedTimeZone,
                                                                 String userId) {
        return getWeeklyTaskSchedule(definitionId, requestedTimeZone, null, userId);
    }

    @Transactional(readOnly = true)
    public StatWeeklyTaskScheduleResponse getWeeklyTaskSchedule(String definitionId,
                                                                 String requestedTimeZone,
                                                                 LocalDate requestedWeekStartDate,
                                                                 String userId) {
        StatDefinition definition = requireBooleanTaskStat(definitionId, userId);
        ZoneId timeZone = resolveTaskTimeZone(requestedTimeZone);
        LocalDate today = LocalDate.now(timeZone);
        LocalDate weekStart = resolveScheduleWeekStart(requestedWeekStartDate, today);
        LocalDateTime now = LocalDateTime.now(timeZone);
        LocalDateTime weekEnd = weekStart.plusWeeks(1).atStartOfDay();

        Map<String, Task> upcomingTasks = taskRepository
                .findAllByLinkedStatDefinitionIdAndStatScheduleWeekStartAndUserId(
                        definitionId, weekStart, userId)
                .stream()
                .filter(task -> isUpcomingTask(task, now, weekEnd))
                .collect(Collectors.toMap(Task::getTaskId, task -> task, (first, ignored) -> first,
                        LinkedHashMap::new));

        if (definition.getRecurringTaskSeriesId() != null) {
            taskRepository.findAllByTaskSeriesIdAndUserIdOrderBySeriesOccurrenceAtAsc(
                            definition.getRecurringTaskSeriesId(), userId)
                    .stream()
                    .filter(task -> task.getSeriesOccurrenceAt() != null)
                    .filter(task -> isUpcomingTask(task, now, weekEnd))
                    .forEach(task -> upcomingTasks.putIfAbsent(task.getTaskId(), task));
        }

        List<Task> sortedTasks = upcomingTasks.values().stream()
                .sorted((left, right) -> taskScheduledAt(left).compareTo(taskScheduledAt(right)))
                .toList();
        List<DayOfWeek> days = sortedTasks.stream()
                .map(task -> taskScheduledAt(task).getDayOfWeek())
                .distinct()
                .toList();
        Task firstTask = sortedTasks.isEmpty() ? null : sortedTasks.get(0);
        LocalTime defaultTime = LocalDateTime.now(timeZone).plusMinutes(5).toLocalTime();
        return new StatWeeklyTaskScheduleResponse(
                weekStart,
                days,
                firstTask == null ? definition.getName() : firstTask.getName(),
                (firstTask == null ? defaultTime : taskScheduledAt(firstTask).toLocalTime()).toString().substring(0, 5),
                firstTask == null ? 3 : firstTask.getImportance());
    }

    @Transactional
    public StatWeeklyTaskScheduleResponse replaceWeeklyTaskSchedule(String definitionId,
                                                                     String requestedTaskName,
                                                                     List<DayOfWeek> requestedDays,
                                                                     String requestedTimeOfDay,
                                                                     Integer requestedImportance,
                                                                     String requestedTimeZone,
                                                                     String userId) {
        return replaceWeeklyTaskSchedule(definitionId, requestedTaskName, requestedDays, requestedTimeOfDay,
                requestedImportance, requestedTimeZone, null, 1, userId);
    }

    @Transactional
    public StatWeeklyTaskScheduleResponse replaceWeeklyTaskSchedule(String definitionId,
                                                                     String requestedTaskName,
                                                                     List<DayOfWeek> requestedDays,
                                                                     String requestedTimeOfDay,
                                                                     Integer requestedImportance,
                                                                     String requestedTimeZone,
                                                                     LocalDate requestedWeekStartDate,
                                                                     Integer requestedWeekCount,
                                                                     String userId) {
        StatDefinition definition = requireBooleanTaskStat(definitionId, userId);
        ZoneId timeZone = resolveTaskTimeZone(requestedTimeZone);
        LocalDate today = LocalDate.now(timeZone);
        LocalDate weekStart = resolveScheduleWeekStart(requestedWeekStartDate, today);
        int weekCount = resolveScheduleWeekCount(requestedWeekCount);
        LocalDateTime now = LocalDateTime.now(timeZone);
        LocalDateTime scheduleEnd = weekStart.plusWeeks(weekCount).atStartOfDay();
        LocalTime timeOfDay = parseWeeklyTaskTime(requestedTimeOfDay);
        int importance = resolveTaskImportance(requestedImportance);
        String taskName = normalizeName(requestedTaskName);
        if (taskName == null || taskName.isBlank()) taskName = definition.getName();
        validateFocusTaskName(taskName);

        List<DayOfWeek> days = requestedDays == null ? List.of() : requestedDays;
        if (days.stream().anyMatch(day -> day == null)
                || days.size() != days.stream().distinct().count()) {
            throw new IllegalArgumentException("Weekly task days must be unique and valid.");
        }
        for (DayOfWeek day : days) {
            LocalDate scheduledDate = nextDateInCurrentWeek(weekStart, day);
            if (weekCount == 1 && weekStart.equals(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY)))
                    && scheduledDate.equals(today) && !scheduledDate.atTime(timeOfDay).isAfter(now)) {
                throw new IllegalArgumentException("Choose a future time for today's task.");
            }
        }

        deleteUpcomingWeeklyTasks(definition, weekStart, scheduleEnd, now, weekCount, userId);
        createWeeklyTasks(definition, taskName, days, weekStart, weekCount,
                timeOfDay, importance, timeZone, now, userId);
        definitionRepository.save(definition);
        log.info("Stat task schedule replaced: userId={} statDefinitionId={} weekStart={} weekCount={} days={} importance={}",
                userId, definitionId, weekStart, weekCount, days, importance);
        return getWeeklyTaskSchedule(definitionId, timeZone.getId(), weekStart, userId);
    }

    @Transactional
    public StatDefinition deleteRecurringTaskFutureOccurrences(String definitionId, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        String seriesId = definition.getRecurringTaskSeriesId();
        if (seriesId == null) return withFocusTaskNames(definition);

        TaskSeriesResponse series = taskSeriesService.getSeries(seriesId, userId);
        ZoneId timeZone = resolveTaskTimeZone(series.timeZone());
        LocalDateTime now = LocalDateTime.now(timeZone);
        List<String> futureTaskIds = taskRepository
                .findAllByTaskSeriesIdAndUserIdOrderBySeriesOccurrenceAtAsc(seriesId, userId)
                .stream()
                .filter(task -> task.getSeriesOccurrenceAt() != null
                        && task.getSeriesOccurrenceAt().isAfter(now))
                .map(Task::getTaskId)
                .toList();
        futureTaskIds.forEach(taskId -> taskService.deleteTaskOccurrence(taskId, userId));
        taskSeriesService.deactivateSeries(seriesId, userId);
        statTaskLinkService.preserveRecurringTaskLinks(seriesId, definitionId, userId);
        definition.setRecurringTaskSeriesId(null);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Future stat recurring tasks removed: userId={} statDefinitionId={} seriesId={} deletedCount={}",
                userId, definitionId, seriesId, futureTaskIds.size());
        return withFocusTaskNames(savedDefinition);
    }

    private StatDefinition requireBooleanTaskStat(String definitionId, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (definition.getSystemKey() != null) {
            throw new IllegalArgumentException("Only user statistics can have linked tasks.");
        }
        if (definition.getType() != StatType.BOOLEAN) {
            throw new IllegalArgumentException("Only true/false statistics can have scheduled tasks.");
        }
        return definition;
    }

    private boolean isUpcomingTask(Task task, LocalDateTime now, LocalDateTime weekEnd) {
        LocalDateTime scheduledAt = taskScheduledAt(task);
        return scheduledAt != null && scheduledAt.isAfter(now) && scheduledAt.isBefore(weekEnd)
                && !task.isCompleted() && !task.isSkipped();
    }

    private LocalDateTime taskScheduledAt(Task task) {
        return task.getScheduledPerformDateTime() != null
                ? task.getScheduledPerformDateTime() : task.getSeriesOccurrenceAt();
    }

    private void deleteUpcomingWeeklyTasks(StatDefinition definition, LocalDate firstWeekStart,
                                          LocalDateTime scheduleEnd, LocalDateTime now,
                                          int weekCount, String userId) {
        for (int week = 0; week < weekCount; week++) {
            LocalDate weekStart = firstWeekStart.plusWeeks(week);
            taskRepository.findAllByLinkedStatDefinitionIdAndStatScheduleWeekStartAndUserId(
                            definition.getId(), weekStart, userId)
                    .stream()
                    .filter(task -> task.getScheduledPerformDateTime() != null
                            && task.getScheduledPerformDateTime().isAfter(now)
                            && !task.isCompleted() && !task.isSkipped())
                    .map(Task::getTaskId)
                    .toList()
                    .forEach(taskId -> taskService.deleteTask(taskId, userId));
        }

        if (definition.getRecurringTaskSeriesId() == null) return;
        taskRepository.findAllByTaskSeriesIdAndUserIdOrderBySeriesOccurrenceAtAsc(
                        definition.getRecurringTaskSeriesId(), userId)
                .stream()
                .filter(task -> task.getSeriesOccurrenceAt() != null
                        && task.getSeriesOccurrenceAt().isAfter(now)
                        && task.getSeriesOccurrenceAt().isBefore(scheduleEnd)
                        && !task.isCompleted() && !task.isSkipped())
                .map(Task::getTaskId)
                .toList()
                .forEach(taskId -> taskService.deleteTaskOccurrence(taskId, userId));
    }

    private void deleteUpcomingStatWeeklyTasks(StatDefinition definition, LocalDateTime now, String userId) {
        taskRepository.findAllByLinkedStatDefinitionIdAndUserId(definition.getId(), userId)
                .stream()
                .filter(task -> task.getStatScheduleWeekStart() != null)
                .filter(task -> task.getScheduledPerformDateTime() != null
                        && task.getScheduledPerformDateTime().isAfter(now))
                .filter(task -> !task.isCompleted() && !task.isSkipped())
                .map(Task::getTaskId)
                .toList()
                .forEach(taskId -> taskService.deleteTask(taskId, userId));
    }

    private void createWeeklyTasks(StatDefinition definition, String taskName, List<DayOfWeek> days,
                                   LocalDate firstWeekStart, int weekCount,
                                   LocalTime timeOfDay, int importance,
                                   ZoneId timeZone, LocalDateTime now, String userId) {
        for (int week = 0; week < weekCount; week++) {
            LocalDate weekStart = firstWeekStart.plusWeeks(week);
            for (DayOfWeek day : days) {
                LocalDate scheduledDate = nextDateInCurrentWeek(weekStart, day);
                if (!scheduledDate.atTime(timeOfDay).isAfter(now)) continue;
                NewTaskRequest request = new NewTaskRequest();
                request.setName(taskName);
                request.setDescription("");
                request.setScheduledPerformDateTime(scheduledDate.atTime(timeOfDay).toString());
                request.setImportance(importance);
                request.setTimeZone(timeZone.getId());
                Task task = taskService.createTask(request, userId);
                statTaskLinkService.linkCreatedWeeklyTaskToStat(task, definition, weekStart);
                linkFocusTaskInternal(definition, taskName);
            }
        }
    }

    private LocalDate resolveScheduleWeekStart(LocalDate requestedWeekStartDate, LocalDate today) {
        LocalDate currentWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        LocalDate requested = requestedWeekStartDate == null ? currentWeekStart : requestedWeekStartDate;
        LocalDate weekStart = requested.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        if (weekStart.isBefore(currentWeekStart)) {
            throw new IllegalArgumentException("A stat task schedule cannot start in a past week.");
        }
        return weekStart;
    }

    private int resolveScheduleWeekCount(Integer requestedWeekCount) {
        int weekCount = requestedWeekCount == null ? 1 : requestedWeekCount;
        if (weekCount < 1 || weekCount > MAX_STAT_TASK_SCHEDULE_WEEKS) {
            throw new IllegalArgumentException("Choose a schedule length between 1 and 104 weeks.");
        }
        return weekCount;
    }

    private LocalDate nextDateInCurrentWeek(LocalDate weekStart, DayOfWeek day) {
        return weekStart.with(TemporalAdjusters.nextOrSame(day));
    }

    private ZoneId resolveTaskTimeZone(String requestedTimeZone) {
        try {
            return requestedTimeZone == null || requestedTimeZone.isBlank()
                    ? ZoneId.systemDefault() : ZoneId.of(requestedTimeZone);
        } catch (java.time.DateTimeException exception) {
            throw new IllegalArgumentException("The task time zone is invalid.", exception);
        }
    }

    private LocalTime parseWeeklyTaskTime(String value) {
        if (value == null || !value.matches("\\d{2}:\\d{2}")) {
            throw new IllegalArgumentException("Choose a valid task time.");
        }
        try {
            return LocalTime.parse(value);
        } catch (java.time.DateTimeException exception) {
            throw new IllegalArgumentException("Choose a valid task time.", exception);
        }
    }

    @Transactional
    public StatDefinition updateRecurringTask(String definitionId, String userId, String requestedTimeZone,
                                              TaskRecurrenceFrequency recurrenceFrequency,
                                              List<DayOfWeek> recurrenceDaysOfWeek) {
        return updateRecurringTask(definitionId, userId, requestedTimeZone, recurrenceFrequency,
                recurrenceDaysOfWeek, null);
    }

    @Transactional
    public StatDefinition updateRecurringTask(String definitionId, String userId, String requestedTimeZone,
                                              TaskRecurrenceFrequency recurrenceFrequency,
                                              List<DayOfWeek> recurrenceDaysOfWeek,
                                              String requestedTimeOfDay) {
        return updateRecurringTask(definitionId, userId, requestedTimeZone, recurrenceFrequency,
                recurrenceDaysOfWeek, requestedTimeOfDay, null);
    }

    @Transactional
    public StatDefinition updateRecurringTask(String definitionId, String userId, String requestedTimeZone,
                                              TaskRecurrenceFrequency recurrenceFrequency,
                                              List<DayOfWeek> recurrenceDaysOfWeek,
                                              String requestedTimeOfDay,
                                              Integer requestedImportance) {
        return updateRecurringTask(definitionId, userId, requestedTimeZone, recurrenceFrequency,
                recurrenceDaysOfWeek, requestedTimeOfDay, requestedImportance, null);
    }

    @Transactional
    public StatDefinition updateRecurringTask(String definitionId, String userId, String requestedTimeZone,
                                              TaskRecurrenceFrequency recurrenceFrequency,
                                              List<DayOfWeek> recurrenceDaysOfWeek,
                                              String requestedTimeOfDay,
                                              Integer requestedImportance,
                                              String requestedTaskName) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (definition.getType() != StatType.BOOLEAN || definition.getRecurringTaskSeriesId() == null) {
            throw new IllegalArgumentException("This statistic has no recurring task to update.");
        }

        TaskRecurrenceFrequency frequency = recurrenceFrequency == null
                ? TaskRecurrenceFrequency.DAILY : recurrenceFrequency;
        if (frequency == TaskRecurrenceFrequency.CUSTOM
                && (recurrenceDaysOfWeek == null || recurrenceDaysOfWeek.isEmpty())) {
            throw new IllegalArgumentException("A custom stat task needs at least one day of the week.");
        }
        TaskSeriesResponse currentSeries = taskSeriesService.getSeries(definition.getRecurringTaskSeriesId(), userId);
        String normalizedTaskName = normalizeName(requestedTaskName);
        boolean taskNameChanged = normalizedTaskName != null
                && !normalizedTaskName.isBlank()
                && !normalizedTaskName.equals(currentSeries.name());
        if (taskNameChanged) {
            validateFocusTaskName(normalizedTaskName);
            taskSeriesService.renameSeries(definition.getRecurringTaskSeriesId(), normalizedTaskName, userId);
            renameRecurringFocusTaskLink(definition, currentSeries.name(), normalizedTaskName);
        }
        LocalDateTime currentStart = currentSeries.startDateTime();
        LocalTime timeOfDay = resolveTimeOfDay(requestedTimeOfDay, currentStart.toLocalTime());
        ZoneId timeZone = resolveTaskTimeZone(requestedTimeZone);
        LocalDateTime startDateTime = frequency == TaskRecurrenceFrequency.CUSTOM
                ? LocalDate.now(timeZone).atTime(timeOfDay)
                : currentStart.toLocalDate().atTime(timeOfDay);
        if (frequency == TaskRecurrenceFrequency.CUSTOM) {
            LocalDateTime now = LocalDateTime.now(timeZone);
            while (!recurrenceDaysOfWeek.contains(startDateTime.getDayOfWeek()) || !startDateTime.isAfter(now)) {
                startDateTime = startDateTime.plusDays(1);
            }
        }
        TaskSeriesUpdateRequest request = new TaskSeriesUpdateRequest();
        request.setRecurrenceFrequency(frequency);
        request.setTimeZone(timeZone.getId());
        if (requestedImportance != null) {
            request.setImportance(resolveTaskImportance(requestedImportance));
        }
        request.setStartDateTime(startDateTime);
        request.setRecurrenceDaysOfWeek(frequency == TaskRecurrenceFrequency.CUSTOM
                ? recurrenceDaysOfWeek : null);
        if (frequency == TaskRecurrenceFrequency.CUSTOM) {
            request.setRecurrenceInterval(1);
            request.setRecurrenceUnit(TaskRecurrenceUnit.WEEKS);
        }
        deleteUpcomingStatWeeklyTasks(definition, LocalDateTime.now(timeZone), userId);
        taskSeriesService.updateSeries(definition.getRecurringTaskSeriesId(), request, userId);
        log.info("Recurring task schedule updated: userId={} statDefinitionId={} seriesId={} frequency={} taskNameChanged={}",
                userId, definitionId, definition.getRecurringTaskSeriesId(), frequency, taskNameChanged);
        return withFocusTaskNames(definition);
    }

    @Transactional
    public StatDefinition deleteRecurringTaskSeries(String definitionId, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        String seriesId = definition.getRecurringTaskSeriesId();
        if (seriesId == null) return withFocusTaskNames(definition);

        taskService.deleteRecurringSeriesCompletely(seriesId, userId);
        definition.setRecurringTaskSeriesId(null);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Recurring task series deleted for boolean stat: userId={} statDefinitionId={} seriesId={}",
                userId, definitionId, seriesId);
        return withFocusTaskNames(savedDefinition);
    }

    @Transactional
    public StatDefinition disconnectRecurringTask(String definitionId, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        String seriesId = definition.getRecurringTaskSeriesId();
        if (seriesId == null) return withFocusTaskNames(definition);

        definition.setRecurringTaskSeriesId(null);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Recurring task disconnected from boolean stat: userId={} statDefinitionId={} seriesId={}",
                userId, savedDefinition.getId(), seriesId);
        return withFocusTaskNames(savedDefinition);
    }

    @Transactional
    public StatDefinition linkFocusTask(String definitionId, String taskName, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        ensureUserStat(definition);

        String normalizedTaskName = normalizeName(taskName);
        validateFocusTaskName(normalizedTaskName);
        linkFocusTaskInternal(definition, normalizedTaskName);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Focus task linked to statistic: userId={} statDefinitionId={} taskName={}",
                userId, savedDefinition.getId(), normalizedTaskName);
        return withFocusTaskNames(savedDefinition);
    }

    @Transactional
    public Task startFocusTask(String definitionId, String requestedTaskName,
                               Integer requestedImportance, String requestedTimeZone,
                               String userId) {
        return startFocusTask(definitionId, requestedTaskName, requestedImportance, requestedTimeZone,
                null, null, userId);
    }

    @Transactional
    public Task startFocusTask(String definitionId, String requestedTaskName,
                               Integer requestedImportance, String requestedTimeZone,
                               String requestedScheduledPerformDateTime, Integer requestedReminderMinutesBefore,
                               String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        ensureUserStat(definition);

        String taskName = normalizeName(requestedTaskName == null || requestedTaskName.isBlank()
                ? definition.getFocusTaskName() == null ? definition.getName() : definition.getFocusTaskName()
                : requestedTaskName);
        if (taskName == null || taskName.isBlank()) {
            throw new IllegalArgumentException("A task name is required.");
        }
        if (taskName.length() > 255) {
            throw new IllegalArgumentException("The task name must be 255 characters or fewer.");
        }

        ZoneId timeZone;
        try {
            timeZone = requestedTimeZone == null || requestedTimeZone.isBlank()
                    ? ZoneId.systemDefault() : ZoneId.of(requestedTimeZone);
        } catch (java.time.DateTimeException exception) {
            throw new IllegalArgumentException("The task time zone is invalid.", exception);
        }

        NewTaskRequest request = new NewTaskRequest();
        request.setName(taskName);
        request.setDescription("");
        String scheduledPerformDateTime = requestedScheduledPerformDateTime == null
                || requestedScheduledPerformDateTime.isBlank()
                ? LocalDateTime.now(timeZone).withSecond(0).withNano(0).toString()
                : requestedScheduledPerformDateTime.trim();
        try {
            LocalDateTime.parse(scheduledPerformDateTime);
        } catch (java.time.format.DateTimeParseException exception) {
            log.warn("Focus task creation rejected because scheduled time is invalid: statDefinitionId={} value={}",
                    definitionId, scheduledPerformDateTime, exception);
            throw new IllegalArgumentException(
                    "Invalid datetime format. Use ISO format: 2024-01-20T10:30:00", exception);
        }
        request.setScheduledPerformDateTime(scheduledPerformDateTime);
        request.setReminderMinutesBefore(requestedReminderMinutesBefore);
        request.setImportance(resolveTaskImportance(requestedImportance));
        request.setTimeZone(timeZone.getId());
        Task task = taskService.createTask(request, userId);
        statTaskLinkService.linkCreatedTaskToStat(task, definition);

        linkFocusTaskInternal(definition, taskName);
        definitionRepository.save(definition);
        log.info("Focus task created from statistic: userId={} statDefinitionId={} taskId={} importance={} scheduledAt={} reminderMinutesBefore={}",
                userId, definitionId, task.getTaskId(), task.getImportance(), scheduledPerformDateTime,
                requestedReminderMinutesBefore);
        return task;
    }

    @Transactional
    public StatDefinition unlinkFocusTask(String definitionId, String userId) {
        return unlinkFocusTask(definitionId, null, userId);
    }

    @Transactional
    public StatDefinition unlinkFocusTask(String definitionId, String taskName, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        ensureUserStat(definition);

        String normalizedTaskName = normalizeName(taskName);
        if (normalizedTaskName == null || normalizedTaskName.isBlank()) {
            focusTaskLinkRepository.deleteAllByStatDefinitionId(definitionId);
            definition.setFocusTaskName(null);
        } else {
            focusTaskLinkRepository.findByStatDefinitionIdAndTaskNameIgnoreCase(definitionId, normalizedTaskName)
                    .ifPresent(focusTaskLinkRepository::delete);
            if (normalizedTaskName.equalsIgnoreCase(definition.getFocusTaskName())) {
                definition.setFocusTaskName(null);
            }
        }
        refreshLegacyFocusTaskName(definition);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Focus task unlinked from statistic: userId={} statDefinitionId={} taskName={}",
                userId, savedDefinition.getId(), normalizedTaskName);
        return withFocusTaskNames(savedDefinition);
    }

    StatDefinition createSystemDefinition(SystemStatDefinition systemStat, User user) {
        String normalizedName = normalizeName(systemStat.name());
        validateDefinition(normalizedName, systemStat.type(), systemStat.minValue(),
                systemStat.maxValue(), systemStat.morality(), systemStat.goodThreshold(),
                user.getId(), null);
        return saveDefinition(normalizedName, systemStat.description(), systemStat.type(),
                systemStat.minValue(), systemStat.maxValue(), systemStat.morality(),
                systemStat.goodThreshold(),
                systemStat.systemKey(), user);
    }

    private StatDefinition resolveParentDefinition(String requestedParentId, String userId,
                                                    String definitionId) {
        String parentId = normalizeParentId(requestedParentId);
        if (parentId == null) return null;
        if (parentId.equals(definitionId)) {
            throw new IllegalArgumentException("A statistic cannot be its own sub-stat.");
        }
        if (definitionId != null
                && definitionRepository.existsByParentDefinitionIdAndUserId(definitionId, userId)) {
            throw new IllegalArgumentException("A statistic with sub-stats cannot become a sub-stat.");
        }
        StatDefinition parent = definitionRepository.findByIdAndUserId(parentId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Choose an available parent statistic."));
        if (parent.getParentDefinitionId() != null) {
            throw new IllegalArgumentException("Choose a top-level statistic as the parent.");
        }
        if (!isDailyStatDefinition(parent)) {
            throw new IllegalArgumentException("Choose a daily statistic as the parent.");
        }
        return parent;
    }

    private String normalizeParentId(String parentId) {
        if (parentId == null || parentId.isBlank()) return null;
        return parentId.trim();
    }

    private String normalizeName(String name) {
        return name == null ? null : name.trim();
    }

    private String normalizeUnit(String unit) {
        if (unit == null) return null;
        String normalized = unit.trim();
        if (normalized.isEmpty()) return null;
        if (normalized.length() > 32) {
            throw new IllegalArgumentException("Statistic unit must be 32 characters or fewer.");
        }
        return normalized;
    }

    private void validateUnit(StatType type, List<StatType> additionalInputTypes, String unit) {
        if (unit != null && type != StatType.NUMBER && !additionalInputTypes.contains(StatType.NUMBER)) {
            throw new IllegalArgumentException("A unit can only be set for a statistic with an amount input.");
        }
    }

    private List<StatType> normalizeAdditionalInputTypes(StatType primaryType,
                                                         List<StatType> additionalInputTypes) {
        if (additionalInputTypes == null || additionalInputTypes.isEmpty()) return List.of();
        Set<StatType> uniqueTypes = new java.util.HashSet<>();
        for (StatType inputType : additionalInputTypes) {
            if (inputType == null || inputType == primaryType || !uniqueTypes.add(inputType)) {
                throw new IllegalArgumentException("Additional stat inputs must be distinct from the primary input.");
            }
        }
        return List.copyOf(additionalInputTypes);
    }

    private Map<StatType, Double> validateAdditionalValues(StatDefinition definition,
                                                           Map<StatType, Double> values) {
        if (values == null || values.isEmpty()) return Map.of();
        Map<StatType, Double> validatedValues = new java.util.EnumMap<>(StatType.class);
        for (Map.Entry<StatType, Double> entry : values.entrySet()) {
            StatType inputType = entry.getKey();
            Double value = entry.getValue();
            if (inputType == null || !definition.getAdditionalInputTypes().contains(inputType) || value == null) {
                throw new IllegalArgumentException("An entry contains an input not configured for this stat.");
            }
            if (inputType == StatType.RANGE) {
                validateInputValue(inputType, value, 0.0, 10.0, definition.getName());
            } else {
                validateInputValue(inputType, value, null, null, definition.getName());
            }
            validatedValues.put(inputType, value);
        }
        return Map.copyOf(validatedValues);
    }

    private void validateFocusTaskName(String taskName) {
        if (taskName == null || taskName.isBlank()) {
            throw new IllegalArgumentException("A task name is required.");
        }
        if (taskName.length() > 255) {
            throw new IllegalArgumentException("The task name must be 255 characters or fewer.");
        }
    }

    private void linkFocusTaskInternal(StatDefinition definition, String taskName) {
        if (focusTaskLinkRepository.findByStatDefinitionIdAndTaskNameIgnoreCase(
                definition.getId(), taskName).isEmpty()) {
            StatFocusTaskLink link = new StatFocusTaskLink();
            link.setStatDefinition(definition);
            link.setTaskName(taskName);
            focusTaskLinkRepository.save(link);
        }
        if (definition.getFocusTaskName() == null) definition.setFocusTaskName(taskName);
    }

    private void refreshLegacyFocusTaskName(StatDefinition definition) {
        List<String> names = getFocusTaskNames(definition);
        definition.setFocusTaskName(names.isEmpty() ? null : names.get(0));
    }

    private void renameRecurringFocusTaskLink(StatDefinition definition,
                                              String previousSeriesName,
                                              String newStatName) {
        if (previousSeriesName == null || previousSeriesName.equalsIgnoreCase(newStatName)) return;

        Optional<StatFocusTaskLink> previousLink = focusTaskLinkRepository
                .findByStatDefinitionIdAndTaskNameIgnoreCase(definition.getId(), previousSeriesName);
        if (previousLink.isPresent()) {
            Optional<StatFocusTaskLink> newNameLink = focusTaskLinkRepository
                    .findByStatDefinitionIdAndTaskNameIgnoreCase(definition.getId(), newStatName);
            if (newNameLink.isPresent() && !newNameLink.get().getId().equals(previousLink.get().getId())) {
                focusTaskLinkRepository.delete(previousLink.get());
            } else {
                previousLink.get().setTaskName(newStatName);
                focusTaskLinkRepository.save(previousLink.get());
            }
        }
        if (previousSeriesName.equalsIgnoreCase(definition.getFocusTaskName())) {
            definition.setFocusTaskName(newStatName);
        }
    }

    private StatDefinition withFocusTaskNames(StatDefinition definition) {
        List<String> names = getFocusTaskNames(definition);
        definition.setFocusTaskNames(names);
        if (!names.isEmpty()) definition.setFocusTaskName(names.get(0));
        return definition;
    }

    private List<String> getFocusTaskNames(StatDefinition definition) {
        List<String> names = new ArrayList<>();
        if (definition.getFocusTaskName() != null && !definition.getFocusTaskName().isBlank()) {
            names.add(definition.getFocusTaskName());
        }
        focusTaskLinkRepository.findAllByStatDefinitionIdOrderByTaskNameAsc(definition.getId())
                .stream()
                .map(StatFocusTaskLink::getTaskName)
                .filter(taskName -> names.stream().noneMatch(existing -> existing.equalsIgnoreCase(taskName)))
                .forEach(names::add);
        return names;
    }

    private LocalTime resolveTimeOfDay(String requestedTimeOfDay, LocalTime fallback) {
        if (requestedTimeOfDay == null || requestedTimeOfDay.isBlank()) return fallback;
        String value = requestedTimeOfDay.trim();
        if (!value.matches("\\d{2}:\\d{2}")) {
            throw new IllegalArgumentException("The recurring task time must use HH:mm format.");
        }
        try {
            return LocalTime.of(Integer.parseInt(value.substring(0, 2)),
                    Integer.parseInt(value.substring(3, 5)));
        } catch (java.time.DateTimeException exception) {
            throw new IllegalArgumentException("The recurring task time is invalid.", exception);
        }
    }

    private void validateDefinition(String name, StatType type, Double minValue,
                                    Double maxValue, StatMorality morality,
                                    Double goodThreshold, String userId,
                                    String excludedDefinitionId) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A stat must have a name.");
        }
        if (type == null) {
            throw new IllegalArgumentException("A stat must have a type.");
        }
        if ((morality == StatMorality.NICE_TO_HAVE || morality == StatMorality.NICE_TO_AVOID)
                && type != StatType.BOOLEAN) {
            throw new IllegalArgumentException("Nice-to-have and nice-to-avoid morality is only valid for Boolean stats.");
        }
        Optional<StatDefinition> sameName = definitionRepository.findByUserIdAndNameIgnoreCase(userId, name);
        if (sameName.isPresent() && !sameName.get().getId().equals(excludedDefinitionId)) {
            throw new IllegalArgumentException("A stat with that name already exists.");
        }
        if (type == StatType.RANGE) {
            if (minValue == null || maxValue == null || minValue.isNaN()
                    || maxValue.isNaN() || !Double.isFinite(minValue)
                    || !Double.isFinite(maxValue) || minValue > maxValue) {
                throw new IllegalArgumentException("Invalid range for stat.");
            }
        }
        if ((type == StatType.TIME || type == StatType.DURATION)
                && (minValue != null || maxValue != null)) {
            throw new IllegalArgumentException("Time and duration stats do not use range bounds.");
        }
        if (morality == null || morality == StatMorality.NEUTRAL) {
            if (goodThreshold != null) {
                throw new IllegalArgumentException("A neutral stat cannot have a good threshold.");
            }
            return;
        }
        if (type == StatType.BOOLEAN) {
            if (goodThreshold != null) {
                throw new IllegalArgumentException("Boolean stats do not use a good threshold.");
            }
            return;
        }
        if (goodThreshold == null || !Double.isFinite(goodThreshold)) {
            throw new IllegalArgumentException("A non-neutral numeric stat must have a good threshold.");
        }
        if (type == StatType.TIME && (goodThreshold < 0 || goodThreshold >= 24 * 60)) {
            throw new IllegalArgumentException("The good threshold for a time stat must be within the day.");
        }
        if (type == StatType.RANGE
                && (goodThreshold < minValue || goodThreshold > maxValue)) {
            throw new IllegalArgumentException("The good threshold must be inside the stat range.");
        }
    }

    private StatDefinition saveDefinition(String name, String description, StatType type,
                                          Double minValue, Double maxValue,
                                          StatMorality morality, Double goodThreshold,
                                          String systemKey,
                                          User user) {
        return saveDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                systemKey, user, List.of());
    }

    private StatDefinition saveDefinition(String name, String description, StatType type,
                                          Double minValue, Double maxValue,
                                          StatMorality morality, Double goodThreshold,
                                          String systemKey,
                                          User user,
                                          List<StatType> additionalInputTypes) {
        return saveDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                systemKey, user, additionalInputTypes, null);
    }

    private StatDefinition saveDefinition(String name, String description, StatType type,
                                          Double minValue, Double maxValue,
                                          StatMorality morality, Double goodThreshold,
                                          String systemKey,
                                          User user,
                                          List<StatType> additionalInputTypes,
                                          String unit) {
        return saveDefinition(name, description, type, minValue, maxValue, morality, goodThreshold,
                systemKey, user, additionalInputTypes, unit, null);
    }

    private StatDefinition saveDefinition(String name, String description, StatType type,
                                          Double minValue, Double maxValue,
                                          StatMorality morality, Double goodThreshold,
                                          String systemKey,
                                          User user,
                                          List<StatType> additionalInputTypes,
                                          String unit,
                                          StatDefinition parentDefinition) {
        StatDefinition definition = new StatDefinition();
        definition.setId(UUID.randomUUID().toString());
        definition.setName(name);
        definition.setDescription(description);
        definition.setType(type);
        definition.setAdditionalInputTypes(additionalInputTypes);
        definition.setUnit(unit);
        definition.setMorality(morality);
        definition.setMinValue(minValue);
        definition.setMaxValue(maxValue);
        definition.setGoodThreshold(goodThreshold);
        definition.setSystemKey(systemKey);
        definition.setParentDefinition(parentDefinition);
        definition.setDisplayOrder(nextDisplayOrder(user.getId()));
        definition.setUser(user);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Stat definition created: userId={} statDefinitionId={} name={} type={} systemKey={}",
                user.getId(), savedDefinition.getId(), savedDefinition.getName(),
                savedDefinition.getType(), savedDefinition.getSystemKey());
        return savedDefinition;
    }

    public List<StatDefinition> getDefinitions(String userId) {
        return getDefinitions(userId, true);
    }

    public List<StatDefinition> getDefinitions(String userId, boolean includeSecret) {
        return definitionRepository.findAllByUserIdOrderByDisplayOrderAsc(userId).stream()
                .filter(this::isDailyStatDefinition)
                .filter(definition -> includeSecret || !definition.isSecret())
                .map(this::withFocusTaskNames)
                .toList();
    }

    @Transactional(readOnly = true)
    public StatBootstrapResponse getBootstrap(LocalDate from, LocalDate to, String userId) {
        return getBootstrap(from, to, userId, true);
    }

    @Transactional(readOnly = true)
    public StatBootstrapResponse getBootstrap(LocalDate from, LocalDate to, String userId,
                                              boolean includeSecret) {
        validatePeriod(from, to);
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such user."));
        List<StatDefinition> definitions = getDefinitions(userId, includeSecret);
        Set<String> definitionIds = definitions.stream()
                .map(StatDefinition::getId)
                .collect(Collectors.toSet());

        Map<String, List<StatEntry>> entriesByDefinition = entryRepository
                .findAllByUserIdAndDateBetween(userId, from, to).stream()
                .filter(entry -> entry.getStatDefinition() != null
                        && definitionIds.contains(entry.getStatDefinition().getId()))
                .collect(Collectors.groupingBy(
                        entry -> entry.getStatDefinition().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));
        Map<String, List<StatEntry>> allEntriesByDefinition = entryRepository.findAllByUserId(userId).stream()
                .filter(entry -> entry.getStatDefinition() != null
                        && definitionIds.contains(entry.getStatDefinition().getId()))
                .collect(Collectors.groupingBy(entry -> entry.getStatDefinition().getId()));
        Map<String, LocalDate> firstLoggedDates = Boolean.TRUE.equals(user.getIncludeUnloggedNumericDaysAsZero())
                ? entryRepository.findFirstLoggedDatesByUserId(userId).stream()
                        .collect(Collectors.toMap(row -> (String) row[0], row -> (LocalDate) row[1]))
                : Map.of();
        Map<String, StatSummaryResponse> summaries = new LinkedHashMap<>();
        for (StatDefinition definition : definitions) {
            List<StatEntry> entries = entriesByDefinition.getOrDefault(definition.getId(), List.of());
            entriesByDefinition.putIfAbsent(definition.getId(), entries);
            List<StatEntry> allEntries = allEntriesByDefinition.getOrDefault(definition.getId(), List.of());
            summaries.put(definition.getId(), summarize(definition, entries, allEntries, from, to, user,
                    firstLoggedDates.get(definition.getId())));
        }

        return new StatBootstrapResponse(from, to, definitions, entriesByDefinition, summaries);
    }

    @Transactional
    public List<StatDefinition> reorderDefinitions(List<String> definitionIds, String userId) {
        return reorderDefinitions(definitionIds, userId, true);
    }

    @Transactional
    public List<StatDefinition> reorderDefinitions(List<String> definitionIds, String userId,
                                                  boolean includeSecret) {
        List<StatDefinition> definitions = definitionRepository.findAllByUserId(userId).stream()
                .filter(this::isDailyStatDefinition)
                .sorted(Comparator.comparing(StatDefinition::getDisplayOrder,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(StatDefinition::getId))
                .toList();
        List<StatDefinition> reorderableDefinitions = definitions.stream()
                .filter(definition -> includeSecret || !definition.isSecret())
                .toList();
        Set<String> existingIds = reorderableDefinitions.stream()
                .map(StatDefinition::getId)
                .collect(Collectors.toSet());

        if (definitionIds == null || definitionIds.size() != reorderableDefinitions.size()
                || definitionIds.stream().anyMatch(id -> id == null)
                || definitionIds.stream().distinct().count() != definitionIds.size()
                || !existingIds.equals(Set.copyOf(definitionIds))) {
            throw new IllegalArgumentException("The reorder list must contain every visible stat exactly once.");
        }

        Map<String, StatDefinition> definitionsById = reorderableDefinitions.stream()
                .collect(Collectors.toMap(StatDefinition::getId, definition -> definition));
        List<StatDefinition> orderedDefinitions;
        if (includeSecret) {
            orderedDefinitions = definitionIds.stream().map(definitionsById::get).toList();
        } else {
            var requestedOrder = definitionIds.iterator();
            orderedDefinitions = definitions.stream()
                    .map(definition -> definition.isSecret() ? definition
                            : definitionsById.get(requestedOrder.next()))
                    .toList();
        }
        for (int index = 0; index < orderedDefinitions.size(); index++) {
            orderedDefinitions.get(index).setDisplayOrder(index);
        }
        definitionRepository.saveAll(definitions);
        log.info("Stat definitions reordered: userId={} count={} orderedDefinitionIds={}",
                userId, definitions.size(), definitionIds);
        return getDefinitions(userId, includeSecret);
    }

    @Transactional
    public StatDefinition updateSecret(String definitionId, boolean secret, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (definition.getSystemKey() != null) {
            throw new IllegalArgumentException("Built-in statistics cannot be secret.");
        }
        definition.setSecret(secret);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Stat privacy updated: userId={} statDefinitionId={} secret={}",
                userId, savedDefinition.getId(), secret);
        return withFocusTaskNames(savedDefinition);
    }

    @Transactional
    public void deleteDefinition(String definitionId, String userId) {
        StatDefinition statDefinition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (statDefinition.getSystemKey() != null) {
            throw new IllegalArgumentException("Cannot delete a system stat.");
        }
        statGroupService.removeDefinitionFromGroups(definitionId, userId);
        definitionRepository.findAllByParentDefinitionIdAndUserId(definitionId, userId)
                .forEach(child -> child.setParentDefinition(null));
        entryRepository.deleteAll(entryRepository.findAllByStatDefinitionIdAndUserId(definitionId, userId));
        focusTaskLinkRepository.deleteAllByStatDefinitionId(definitionId);
        definitionRepository.delete(statDefinition);
        log.info("Stat definition deleted: userId={} statDefinitionId={} name={}",
                userId, definitionId, statDefinition.getName());
    }

    /** A null value means that the dated stat entry should be cleared. */
    @Transactional
    public StatEntry recordEntry(String statDefinitionId, LocalDate date, Number value, String userId) {
        return recordEntry(statDefinitionId, date,
                value == null ? null : value.doubleValue(), StatEntryStatus.RECORDED, null, userId, false);
    }

    @Transactional
    public StatEntry recordEntry(String statDefinitionId, LocalDate date, Number value,
                                 StatEntryStatus status, String userId) {
        return recordEntry(statDefinitionId, date,
                value == null ? null : value.doubleValue(), status, null, userId, false);
    }

    @Transactional
    public StatEntry recordEntry(String statDefinitionId, LocalDate date, Number value,
                                 StatEntryStatus status, Map<StatType, Double> additionalValues,
                                 String userId) {
        return recordEntry(statDefinitionId, date,
                value == null ? null : value.doubleValue(), status, additionalValues, userId, false);
    }

    private StatEntry recordEntry(String statDefinitionId, LocalDate date, Double requestedValue,
                                  StatEntryStatus requestedStatus, Map<StatType, Double> requestedAdditionalValues,
                                  String userId, boolean automatic) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(statDefinitionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Stat definition not found: " + statDefinitionId));

        StatEntryStatus status = requestedStatus == null ? StatEntryStatus.RECORDED : requestedStatus;
        Double value = requestedValue == null ? null : requestedValue;
        if (status == StatEntryStatus.NOT_PLANNED) {
            value = 0.0;
        }
        if (status == StatEntryStatus.NOT_PLANNED && definition.getType() != StatType.BOOLEAN) {
            throw new IllegalArgumentException("Only boolean statistics can be marked as not planned.");
        }

        if (!automatic && SystemStatCatalog.isAutomaticallyLoggedSystemKey(definition.getSystemKey())
                && !SystemStatCatalog.MEDITATED_SYSTEM_KEY.equals(definition.getSystemKey())) {
            throw new IllegalArgumentException("Meditation minutes are recorded automatically when a session ends.");
        }
        if (!isDailyStatDefinition(definition)) {
            throw new IllegalArgumentException("Mental state ratings must be recorded as a combined check-in.");
        }

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Optional<StatEntry> existingEntry = entryRepository.findByStatDefinitionIdAndUserIdAndDate(statDefinitionId,
                userId,
                date);
        if (value == null) {
            if (requestedAdditionalValues != null && !requestedAdditionalValues.isEmpty()) {
                throw new IllegalArgumentException("A primary stat value is required when recording additional inputs.");
            }
            existingEntry.ifPresent(entryRepository::delete);
            if (existingEntry.isPresent()) {
                statTaskLinkService.synchronizeStatEntry(
                        definition, date, null, StatEntryStatus.RECORDED, userId);
                log.info("Stat value cleared: userId={} statDefinitionId={} statName={} date={}",
                        userId, definition.getId(), definition.getName(), date);
            }
            maybeCalculateSleepDuration(definition, date, userId);
            return null;
        }

        validateValue(definition, value);
        Map<StatType, Double> additionalValues = requestedAdditionalValues == null
                ? existingEntry.map(StatEntry::getAdditionalValues).orElse(Map.of())
                : validateAdditionalValues(definition, requestedAdditionalValues);

        Double previousValue = existingEntry.map(StatEntry::getValue).orElse(null);
        StatEntry statEntry = existingEntry.orElseGet(() -> createEntry(definition, date, user));
        statEntry.setValue(value);
        statEntry.setStatus(status);
        statEntry.setAdditionalValues(additionalValues);
        StatEntry savedEntry = entryRepository.save(statEntry);
        log.info("Stat value {}: userId={} statDefinitionId={} statName={} date={} value={} status={} previousValue={}",
                previousValue == null ? "recorded" : "updated",
                userId, definition.getId(), definition.getName(), date, value, status, previousValue);
        statTaskLinkService.synchronizeStatEntry(definition, date, value, status, userId);
        maybeCalculateSleepDuration(definition, date, userId);
        return savedEntry;
    }

    private void maybeCalculateSleepDuration(StatDefinition changedDefinition, LocalDate changedDate,
                                             String userId) {
        String systemKey = changedDefinition.getSystemKey();
        if (!SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY.equals(systemKey)
                && !SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY.equals(systemKey)) {
            return;
        }

        LocalDate sleepDate = SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY.equals(systemKey)
                ? changedDate
                : changedDate.minusDays(1);
        LocalDate wakeUpDate = sleepDate.plusDays(1);

        Optional<StatDefinition> sleepTimeDefinition = definitionRepository
                .findByUserIdAndSystemKey(userId, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY);
        Optional<StatDefinition> wakeUpTimeDefinition = definitionRepository
                .findByUserIdAndSystemKey(userId, SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY);
        Optional<StatDefinition> sleepDurationDefinition = definitionRepository
                .findByUserIdAndSystemKey(userId, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY);
        if (sleepTimeDefinition.isEmpty() || wakeUpTimeDefinition.isEmpty()
                || sleepDurationDefinition.isEmpty()) {
            return;
        }

        Optional<StatEntry> sleepEntry = entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                sleepTimeDefinition.get().getId(), userId, sleepDate);
        Optional<StatEntry> wakeUpEntry = entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                wakeUpTimeDefinition.get().getId(), userId, wakeUpDate);
        if (sleepEntry.isEmpty() || wakeUpEntry.isEmpty()) return;

        int sleepMinutes = (int) Math.round(sleepEntry.get().getValue());
        int wakeUpMinutes = (int) Math.round(wakeUpEntry.get().getValue());
        int durationMinutes = wakeUpMinutes - sleepMinutes;
        if (durationMinutes <= 0) durationMinutes += StatTimeScale.MINUTES_PER_DAY;

        recordEntry(sleepDurationDefinition.get().getId(), wakeUpDate,
                (double) durationMinutes, StatEntryStatus.RECORDED, null, userId, true);
        log.info("Sleep duration calculated: userId={} sleepDate={} wakeUpDate={} durationMinutes={}",
                userId, sleepDate, wakeUpDate, durationMinutes);
    }

    @Transactional
    public void recordCompletedMeditation(LocalDate date, Duration duration, String userId) {
        if (duration == null || duration.isNegative()) {
            throw new IllegalArgumentException("Meditation duration cannot be null or negative.");
        }

        StatDefinition meditatedDefinition = getSystemDefinition(
                userId, SystemStatCatalog.MEDITATED_SYSTEM_KEY);
        StatDefinition minutesDefinition = getSystemDefinition(
                userId, SystemStatCatalog.MEDITATION_MINUTES_SYSTEM_KEY);

        recordEntry(meditatedDefinition.getId(), date, 1.0, StatEntryStatus.RECORDED, null, userId, true);

        double existingMinutes = entryRepository
                .findByStatDefinitionIdAndUserIdAndDate(minutesDefinition.getId(), userId, date)
                .map(StatEntry::getValue)
                .orElse(0.0);
        double sessionMinutes = duration.toMillis() / 60_000.0;
        recordEntry(minutesDefinition.getId(), date, existingMinutes + sessionMinutes,
                StatEntryStatus.RECORDED, null, userId, true);

        log.info("Meditation stats recorded: userId={} date={} sessionMinutes={} dailyMinutes={}",
                userId, date, sessionMinutes, existingMinutes + sessionMinutes);
    }

    public List<StatEntry> getEntries(String statDefinitionId, LocalDate from, LocalDate to, String userId) {
        definitionRepository.findByIdAndUserId(statDefinitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat exists."));

        return entryRepository.findAllByStatDefinitionIdAndUserIdAndDateBetween(statDefinitionId,
                userId, from, to);
    }

    @Transactional(readOnly = true)
    public List<StatFocusTimeEntryResponse> getFocusTime(String definitionId, LocalDate from,
                                                         LocalDate to, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat exists."));
        validatePeriod(from, to);
        Map<LocalDate, Long> focusByDate = new TreeMap<>();
        String seriesId = definition.getRecurringTaskSeriesId();
        if (seriesId != null) {
            taskService.getPomodoroFocusTimeForSeries(seriesId, from, to, userId)
                    .forEach((date, seconds) -> focusByDate.merge(date, seconds, Long::sum));
        }
        taskService.getPomodoroFocusTimeForTaskNames(getFocusTaskNames(definition), from, to, userId, seriesId)
                .forEach((date, seconds) -> focusByDate.merge(date, seconds, Long::sum));

        return focusByDate.entrySet().stream()
                .map(entry -> new StatFocusTimeEntryResponse(entry.getKey(), entry.getValue()))
                .toList();
    }

    public List<StatEntry> getTodayEntries(String userId) {
        return getTodayEntries(userId, true);
    }

    @Transactional(readOnly = true)
    public List<StatEntry> getTodayEntries(String userId, boolean includeSecret) {
        return filterSecretEntries(entryRepository.findAllByUserIdAndDate(userId, LocalDate.now()), includeSecret);
    }

    public List<StatEntry> getEntriesByDate(LocalDate date, String userId) {
        return getEntriesByDate(date, userId, true);
    }

    @Transactional(readOnly = true)
    public List<StatEntry> getEntriesByDate(LocalDate date, String userId, boolean includeSecret) {
        return filterSecretEntries(entryRepository.findAllByUserIdAndDate(userId, date), includeSecret);
    }

    private List<StatEntry> filterSecretEntries(List<StatEntry> entries, boolean includeSecret) {
        if (includeSecret) return entries;
        return entries.stream()
                .filter(entry -> entry.getStatDefinition() == null || !entry.getStatDefinition().isSecret())
                .toList();
    }

    public StatSummaryResponse getSummary(String definitionId, LocalDate from, LocalDate to, String userId) {
        StatDefinition def = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such user."));
        validatePeriod(from, to);

        List<StatEntry> entries = entryRepository
                .findAllByStatDefinitionIdAndUserIdAndDateBetween(definitionId, userId, from, to);
        List<StatEntry> allEntries = entryRepository.findAllByStatDefinitionIdAndUserId(definitionId, userId);

        LocalDate firstLoggedDate = Boolean.TRUE.equals(user.getIncludeUnloggedNumericDaysAsZero())
                ? entryRepository.findFirstLoggedDate(definitionId, userId)
                : null;
        return summarize(def, entries, allEntries, from, to, user, firstLoggedDate);
    }

    private StatSummaryResponse summarize(StatDefinition def, List<StatEntry> entries,
                                          List<StatEntry> allEntries,
                                          LocalDate from, LocalDate to, User user, LocalDate firstLoggedDate) {

        Map<LocalDate, Double> valueByDate = entries.stream()
                .collect(Collectors.toMap(StatEntry::getDate, StatEntry::getValue));

        int checkInStreak = computeStreak(to, from, valueByDate::containsKey);

        Integer periodYesCount = null;
        Integer booleanStreak = null;
        Integer longestBooleanStreak = null;
        Integer allTimeLongestBooleanStreak = null;
        Double periodAverage = null;
        Double periodTotal = null;
        Double periodHighest = null;
        Double personalBest = null;
        LocalDate averageStartDate = null;

        if (def.getType() == StatType.BOOLEAN) {
            periodYesCount = (int) entries.stream()
                    .filter(entry -> entry.getStatus() != StatEntryStatus.NOT_PLANNED)
                    .filter(entry -> entry.getValue() == 1.0)
                    .count();
            booleanStreak = computeStreak(to, from,
                    date -> valueByDate.containsKey(date)
                            && entries.stream().filter(entry -> entry.getDate().equals(date))
                            .noneMatch(entry -> entry.getStatus() == StatEntryStatus.NOT_PLANNED)
                            && valueByDate.get(date) == 1.0);
            longestBooleanStreak = computeLongestStreak(from, to,
                    date -> valueByDate.containsKey(date)
                            && entries.stream().filter(entry -> entry.getDate().equals(date))
                            .noneMatch(entry -> entry.getStatus() == StatEntryStatus.NOT_PLANNED)
                            && valueByDate.get(date) == 1.0);
            if (!allEntries.isEmpty()) {
                Map<LocalDate, StatEntry> allEntriesByDate = allEntries.stream()
                        .collect(Collectors.toMap(StatEntry::getDate, entry -> entry));
                LocalDate firstDate = allEntriesByDate.keySet().stream().min(LocalDate::compareTo).orElseThrow();
                LocalDate lastDate = allEntriesByDate.keySet().stream().max(LocalDate::compareTo).orElseThrow();
                allTimeLongestBooleanStreak = computeLongestStreak(firstDate, lastDate, date -> {
                    StatEntry entry = allEntriesByDate.get(date);
                    return entry != null && entry.getStatus() != StatEntryStatus.NOT_PLANNED
                            && entry.getValue() == 1.0;
                });
            } else {
                allTimeLongestBooleanStreak = 0;
            }
        }

        if (def.getType() != StatType.BOOLEAN) {
            personalBest = computePersonalBest(def, allEntries);
        }

        if (def.getType() == StatType.NUMBER || def.getType() == StatType.RANGE
                || def.getType() == StatType.DURATION) {
            periodTotal = entries.stream()
                    .mapToDouble(StatEntry::getValue)
                    .sum();
            periodHighest = entries.stream()
                    .map(StatEntry::getValue)
                    .max(Double::compareTo)
                    .orElse(null);
            boolean countUnloggedDaysAsZero = !SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY.equals(def.getSystemKey())
                    && Boolean.TRUE.equals(user.getIncludeUnloggedNumericDaysAsZero());
            if (countUnloggedDaysAsZero && firstLoggedDate != null && !firstLoggedDate.isAfter(to)) {
                averageStartDate = firstLoggedDate.isAfter(from) ? firstLoggedDate : from;
                long periodDays = ChronoUnit.DAYS.between(averageStartDate, to) + 1;
                periodAverage = periodTotal / periodDays;
            } else if (!entries.isEmpty()) {
                periodAverage = periodTotal / entries.size();
            }
        }

        if (def.getType() == StatType.TIME) {
            periodTotal = entries.stream()
                    .mapToDouble(entry -> StatTimeScale.toLinearValue(def, entry.getValue()))
                    .sum();
            var latest = entries.stream()
                    .mapToDouble(entry -> StatTimeScale.toLinearValue(def, entry.getValue()))
                    .max();
            periodHighest = latest.isPresent()
                    ? StatTimeScale.fromLinearValue(def, latest.getAsDouble())
                    : null;
            if (!entries.isEmpty()) {
                periodAverage = StatTimeScale.fromLinearValue(def, periodTotal / entries.size());
            }
        }

        return new StatSummaryResponse(checkInStreak, periodYesCount, booleanStreak, longestBooleanStreak,
                allTimeLongestBooleanStreak, periodAverage, periodTotal, periodHighest, personalBest,
                averageStartDate);
    }

    private Double computePersonalBest(StatDefinition definition, List<StatEntry> entries) {
        if (entries.isEmpty()) return null;
        boolean lowerIsBetter = definition.getType() == StatType.TIME
                ? definition.getMorality() == StatMorality.GOOD
                : definition.getMorality() == StatMorality.BAD
                    || definition.getMorality() == StatMorality.NICE_TO_AVOID;
        Comparator<Double> comparator = Comparator.comparingDouble(value -> definition.getType() == StatType.TIME
                ? StatTimeScale.toLinearValue(definition, value)
                : value);
        if (!lowerIsBetter) comparator = comparator.reversed();
        return entries.stream()
                .map(StatEntry::getValue)
                .min(comparator)
                .orElse(null);
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("The summary period must have a valid start and end date.");
        }
    }

    /**
     * Counts consecutive days ending at {@code endDate} for which {@code hasEntry} is true.
     * If the end date itself has no entry, counts backwards from the previous day.
     */
    private int computeStreak(LocalDate endDate, LocalDate lowerBound, Predicate<LocalDate> hasEntry) {
        LocalDate start = hasEntry.test(endDate) ? endDate : endDate.minusDays(1);
        if (start.isBefore(lowerBound)) return 0;

        int streak = 0;
        LocalDate cursor = start;
        while (!cursor.isBefore(lowerBound) && hasEntry.test(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private int computeLongestStreak(LocalDate lowerBound, LocalDate upperBound,
                                     Predicate<LocalDate> hasEntry) {
        int longest = 0;
        int current = 0;
        LocalDate cursor = lowerBound;
        while (!cursor.isAfter(upperBound)) {
            if (hasEntry.test(cursor)) {
                current++;
                longest = Math.max(longest, current);
            } else {
                current = 0;
            }
            cursor = cursor.plusDays(1);
        }
        return longest;
    }

    private StatEntry createEntry(StatDefinition statDefinition, LocalDate date, User user) {
        return StatEntry.builder()
                .id(UUID.randomUUID().toString())
                .statDefinition(statDefinition)
                .date(date)
                .user(user)
                .build();
    }

    private StatDefinition getSystemDefinition(String userId, String systemKey) {
        return definitionRepository.findByUserIdAndSystemKey(userId, systemKey)
                .orElseThrow(() -> new IllegalStateException(
                        "Missing system stat definition: " + systemKey));
    }

    private int nextDisplayOrder(String userId) {
        return definitionRepository.findAllByUserId(userId).stream()
                .map(StatDefinition::getDisplayOrder)
                .filter(order -> order != null)
                .max(Integer::compareTo)
                .map(order -> order + 1)
                .orElse(0);
    }

    private boolean isDailyStatDefinition(StatDefinition definition) {
        return !SystemStatCatalog.isMentalStateSystemKey(definition.getSystemKey());
    }

    private void ensureUserStat(StatDefinition definition) {
        if (definition.getSystemKey() != null) {
            throw new IllegalArgumentException("Only user statistics can link task focus time.");
        }
    }

    private int resolveTaskImportance(Integer requestedImportance) {
        int importance = requestedImportance == null ? 0 : requestedImportance;
        if (importance < 0 || importance > 10) {
            throw new IllegalArgumentException("Task priority must be between 0 and 10.");
        }
        return importance;
    }

    private void validateValue(StatDefinition statDefinition, Double value) {
        validateInputValue(statDefinition.getType(), value, statDefinition.getMinValue(),
                statDefinition.getMaxValue(), statDefinition.getName());
    }

    private void validateInputValue(StatType type, Double value, Double minValue,
                                    Double maxValue, String statName) {
        if (value == null || !Double.isFinite(value)) {
            throw new IllegalArgumentException("Stat values must be finite numbers: " + statName);
        }
        switch (type) {
            case StatType.BOOLEAN -> {
                if (!value.equals(0.0) && !value.equals(1.0)) {
                    throw new IllegalArgumentException("Invalid value for true/false stat: "
                    + statName);
                }
            }
            case StatType.RANGE -> {
                if (value > maxValue || value < minValue) {
                    throw new IllegalArgumentException("Value out of range for stat: "
                    + statName);
                }
            }
            case StatType.TIME -> {
                if (value < 0 || value >= 24 * 60 || value % 1 != 0) {
                    throw new IllegalArgumentException("Time values must be between 00:00 and 23:59: "
                            + statName);
                }
            }
            case StatType.DURATION -> {
                if (value < 0 || value % 1 != 0) {
                    throw new IllegalArgumentException("Duration values must be whole, non-negative minutes: "
                            + statName);
                }
            }
            case StatType.NUMBER -> {}
            default -> throw new IllegalStateException("Invalid stat type: " + type);
        }
    }
}
