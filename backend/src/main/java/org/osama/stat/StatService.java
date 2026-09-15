package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.requests.NewTaskRequest;
import org.osama.task.Task;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@Slf4j
public class StatService {

    private final StatDefinitionRepository definitionRepository;
    private final StatFocusTaskLinkRepository focusTaskLinkRepository;
    private final StatEntryRepository entryRepository;
    private final UserRepository userRepository;
    private final StatGroupService statGroupService;
    private final TaskSeriesService taskSeriesService;
    private final StatTaskLinkService statTaskLinkService;
    private final TaskService taskService;

    public StatService(StatDefinitionRepository definitionRepository,
                       StatFocusTaskLinkRepository focusTaskLinkRepository,
                       StatEntryRepository entryRepository,
                       UserRepository userRepository,
                       StatGroupService statGroupService,
                       TaskSeriesService taskSeriesService,
                       StatTaskLinkService statTaskLinkService,
                       TaskService taskService) {
        this.definitionRepository = definitionRepository;
        this.focusTaskLinkRepository = focusTaskLinkRepository;
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
        this.statGroupService = statGroupService;
        this.taskSeriesService = taskSeriesService;
        this.statTaskLinkService = statTaskLinkService;
        this.taskService = taskService;
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
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        String normalizedName = normalizeName(name);
        validateDefinition(normalizedName, type, minValue, maxValue, morality, goodThreshold, userId, null);
        StatDefinition definition = saveDefinition(normalizedName, description, type, minValue, maxValue,
                morality, goodThreshold, null, user);
        return createRecurringTask
                ? createRecurringTask(definition.getId(), userId, null, recurrenceFrequency,
                recurrenceDaysOfWeek, requestedTimeOfDay, recurringTaskImportance)
                : definition;
    }

    @Transactional
    public StatDefinition updateDefinition(String definitionId, String name, String description,
                                           StatMorality morality, Double goodThreshold,
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
        definition.setName(normalizedName);
        definition.setDescription(description);
        definition.setMorality(morality);
        definition.setGoodThreshold(goodThreshold);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Stat definition updated: userId={} statDefinitionId={} name={} morality={} goodThreshold={}",
                userId, savedDefinition.getId(), savedDefinition.getName(),
                savedDefinition.getMorality(), savedDefinition.getGoodThreshold());
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
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (definition.getType() != StatType.BOOLEAN || definition.getRecurringTaskSeriesId() == null) {
            throw new IllegalArgumentException("This statistic has no recurring task to update.");
        }

        TaskRecurrenceFrequency frequency = recurrenceFrequency == null
                ? TaskRecurrenceFrequency.DAILY : recurrenceFrequency;
        TaskSeriesResponse currentSeries = taskSeriesService.getSeries(definition.getRecurringTaskSeriesId(), userId);
        LocalDateTime currentStart = currentSeries.startDateTime();
        LocalTime timeOfDay = resolveTimeOfDay(requestedTimeOfDay, currentStart.toLocalTime());
        TaskSeriesUpdateRequest request = new TaskSeriesUpdateRequest();
        request.setRecurrenceFrequency(frequency);
        request.setTimeZone(requestedTimeZone);
        if (requestedImportance != null) {
            request.setImportance(resolveTaskImportance(requestedImportance));
        }
        request.setStartDateTime(currentStart.toLocalDate().atTime(timeOfDay));
        request.setRecurrenceDaysOfWeek(frequency == TaskRecurrenceFrequency.CUSTOM
                ? recurrenceDaysOfWeek : null);
        if (frequency == TaskRecurrenceFrequency.CUSTOM) {
            if (recurrenceDaysOfWeek == null || recurrenceDaysOfWeek.isEmpty()) {
                throw new IllegalArgumentException("A custom stat task needs at least one day of the week.");
            }
            request.setRecurrenceInterval(1);
            request.setRecurrenceUnit(TaskRecurrenceUnit.WEEKS);
        }
        taskSeriesService.updateSeries(definition.getRecurringTaskSeriesId(), request, userId);
        statTaskLinkService.synchronizeExistingEntries(definition, userId);
        log.info("Recurring task schedule updated: userId={} statDefinitionId={} seriesId={} frequency={}",
                userId, definitionId, definition.getRecurringTaskSeriesId(), frequency);
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
        request.setScheduledPerformDateTime(LocalDateTime.now(timeZone).withSecond(0).withNano(0).toString());
        request.setImportance(resolveTaskImportance(requestedImportance));
        request.setTimeZone(timeZone.getId());
        Task task = taskService.createTask(request, userId);

        linkFocusTaskInternal(definition, taskName);
        definitionRepository.save(definition);
        log.info("Focus task started from statistic: userId={} statDefinitionId={} taskId={} importance={}",
                userId, definitionId, task.getTaskId(), task.getImportance());
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

    private String normalizeName(String name) {
        return name == null ? null : name.trim();
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
        StatDefinition definition = new StatDefinition();
        definition.setId(UUID.randomUUID().toString());
        definition.setName(name);
        definition.setDescription(description);
        definition.setType(type);
        definition.setMorality(morality);
        definition.setMinValue(minValue);
        definition.setMaxValue(maxValue);
        definition.setGoodThreshold(goodThreshold);
        definition.setSystemKey(systemKey);
        definition.setDisplayOrder(nextDisplayOrder(user.getId()));
        definition.setUser(user);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Stat definition created: userId={} statDefinitionId={} name={} type={} systemKey={}",
                user.getId(), savedDefinition.getId(), savedDefinition.getName(),
                savedDefinition.getType(), savedDefinition.getSystemKey());
        return savedDefinition;
    }

    public List<StatDefinition> getDefinitions(String userId) {
        return definitionRepository.findAllByUserIdOrderByDisplayOrderAsc(userId).stream()
                .filter(this::isDailyStatDefinition)
                .map(this::withFocusTaskNames)
                .toList();
    }

    @Transactional(readOnly = true)
    public StatBootstrapResponse getBootstrap(LocalDate from, LocalDate to, String userId) {
        validatePeriod(from, to);
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such user."));
        List<StatDefinition> definitions = getDefinitions(userId);
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
        Map<String, StatSummaryResponse> summaries = new LinkedHashMap<>();
        for (StatDefinition definition : definitions) {
            List<StatEntry> entries = entriesByDefinition.getOrDefault(definition.getId(), List.of());
            entriesByDefinition.putIfAbsent(definition.getId(), entries);
            summaries.put(definition.getId(), summarize(definition, entries, from, to, user));
        }

        return new StatBootstrapResponse(from, to, definitions, entriesByDefinition, summaries);
    }

    @Transactional
    public List<StatDefinition> reorderDefinitions(List<String> definitionIds, String userId) {
        List<StatDefinition> definitions = definitionRepository.findAllByUserId(userId).stream()
                .filter(this::isDailyStatDefinition)
                .toList();
        Set<String> existingIds = definitions.stream()
                .map(StatDefinition::getId)
                .collect(Collectors.toSet());

        if (definitionIds == null || definitionIds.size() != definitions.size()
                || definitionIds.stream().anyMatch(id -> id == null)
                || definitionIds.stream().distinct().count() != definitionIds.size()
                || !existingIds.equals(Set.copyOf(definitionIds))) {
            throw new IllegalArgumentException("The reorder list must contain every stat exactly once.");
        }

        Map<String, StatDefinition> definitionsById = definitions.stream()
                .collect(Collectors.toMap(StatDefinition::getId, definition -> definition));
        for (int index = 0; index < definitionIds.size(); index++) {
            definitionsById.get(definitionIds.get(index)).setDisplayOrder(index);
        }
        definitionRepository.saveAll(definitions);
        log.info("Stat definitions reordered: userId={} count={} orderedDefinitionIds={}",
                userId, definitions.size(), definitionIds);
        return getDefinitions(userId);
    }

    @Transactional
    public void deleteDefinition(String definitionId, String userId) {
        StatDefinition statDefinition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (statDefinition.getSystemKey() != null) {
            throw new IllegalArgumentException("Cannot delete a system stat.");
        }
        statGroupService.removeDefinitionFromGroups(definitionId, userId);
        focusTaskLinkRepository.deleteAllByStatDefinitionId(definitionId);
        definitionRepository.delete(statDefinition);
        log.info("Stat definition deleted: userId={} statDefinitionId={} name={}",
                userId, definitionId, statDefinition.getName());
    }

    /** A null value means that the dated stat entry should be cleared. */
    @Transactional
    public StatEntry recordEntry(String statDefinitionId, LocalDate date, Number value, String userId) {
        return recordEntry(statDefinitionId, date,
                value == null ? null : value.doubleValue(), StatEntryStatus.RECORDED, userId, false);
    }

    @Transactional
    public StatEntry recordEntry(String statDefinitionId, LocalDate date, Number value,
                                 StatEntryStatus status, String userId) {
        return recordEntry(statDefinitionId, date,
                value == null ? null : value.doubleValue(), status, userId, false);
    }

    private StatEntry recordEntry(String statDefinitionId, LocalDate date, Double requestedValue,
                                  StatEntryStatus requestedStatus, String userId, boolean automatic) {
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

        if (!automatic && SystemStatCatalog.isAutomaticallyLoggedSystemKey(definition.getSystemKey())) {
            throw new IllegalArgumentException("Meditation stats are recorded automatically when a session ends.");
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

        Double previousValue = existingEntry.map(StatEntry::getValue).orElse(null);
        StatEntry statEntry = existingEntry.orElseGet(() -> createEntry(definition, date, user));
        statEntry.setValue(value);
        statEntry.setStatus(status);
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
                (double) durationMinutes, StatEntryStatus.RECORDED, userId, true);
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

        recordEntry(meditatedDefinition.getId(), date, 1.0, StatEntryStatus.RECORDED, userId, true);

        double existingMinutes = entryRepository
                .findByStatDefinitionIdAndUserIdAndDate(minutesDefinition.getId(), userId, date)
                .map(StatEntry::getValue)
                .orElse(0.0);
        double sessionMinutes = duration.toMillis() / 60_000.0;
        recordEntry(minutesDefinition.getId(), date, existingMinutes + sessionMinutes,
                StatEntryStatus.RECORDED, userId, true);

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
        return entryRepository.findAllByUserIdAndDate(userId, LocalDate.now());
    }

    public List<StatEntry> getEntriesByDate(LocalDate date, String userId) {
        return entryRepository.findAllByUserIdAndDate(userId, date);
    }

    public StatSummaryResponse getSummary(String definitionId, LocalDate from, LocalDate to, String userId) {
        StatDefinition def = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such user."));
        validatePeriod(from, to);

        List<StatEntry> entries = entryRepository
                .findAllByStatDefinitionIdAndUserIdAndDateBetween(definitionId, userId, from, to);

        return summarize(def, entries, from, to, user);
    }

    private StatSummaryResponse summarize(StatDefinition def, List<StatEntry> entries,
                                          LocalDate from, LocalDate to, User user) {

        Map<LocalDate, Double> valueByDate = entries.stream()
                .collect(Collectors.toMap(StatEntry::getDate, StatEntry::getValue));

        int checkInStreak = computeStreak(to, from, valueByDate::containsKey);

        Integer periodYesCount = null;
        Integer booleanStreak = null;
        Integer longestBooleanStreak = null;
        Double periodAverage = null;
        Double periodTotal = null;
        Double periodHighest = null;

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
            if (countUnloggedDaysAsZero) {
                long periodDays = ChronoUnit.DAYS.between(from, to) + 1;
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
                periodAverage, periodTotal, periodHighest);
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
        switch (statDefinition.getType()) {
            case StatType.BOOLEAN -> {
                if (!value.equals(0.0) && !value.equals(1.0)) {
                    throw new IllegalArgumentException("Invalid value for true/false stat: "
                    + statDefinition.getName());
                }
            }
            case StatType.RANGE -> {
                if (value > statDefinition.getMaxValue() || value < statDefinition.getMinValue()) {
                    throw new IllegalArgumentException("Value out of range for stat: "
                    + statDefinition.getName());
                }
            }
            case StatType.TIME -> {
                if (!Double.isFinite(value) || value < 0 || value >= 24 * 60 || value % 1 != 0) {
                    throw new IllegalArgumentException("Time values must be between 00:00 and 23:59: "
                            + statDefinition.getName());
                }
            }
            case StatType.DURATION -> {
                if (!Double.isFinite(value) || value < 0 || value % 1 != 0) {
                    throw new IllegalArgumentException("Duration values must be whole, non-negative minutes: "
                            + statDefinition.getName());
                }
            }
            case StatType.NUMBER -> {}
            default -> throw new IllegalStateException("Invalid stat type: " + statDefinition.getType());
        }
    }
}
