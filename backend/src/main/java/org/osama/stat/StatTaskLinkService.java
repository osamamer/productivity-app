package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskSkipReason;
import org.osama.task.recurrence.events.TaskSeriesOccurrencesChangedEvent;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Keeps concrete tasks linked to a statistic in step with the statistic
 * entries without routing one side through the other service.
 * That separation prevents stat-to-task-to-stat update recursion.
 */
@Service
@Slf4j
public class StatTaskLinkService {

    private final StatDefinitionRepository definitionRepository;
    private final StatEntryRepository entryRepository;
    private final StatFocusTaskLinkRepository focusTaskLinkRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public StatTaskLinkService(StatDefinitionRepository definitionRepository,
                               StatEntryRepository entryRepository,
                               StatFocusTaskLinkRepository focusTaskLinkRepository,
                               TaskRepository taskRepository,
                               UserRepository userRepository) {
        this.definitionRepository = definitionRepository;
        this.entryRepository = entryRepository;
        this.focusTaskLinkRepository = focusTaskLinkRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void synchronizeStatEntry(StatDefinition definition, LocalDate date,
                                     Double value, StatEntryStatus status, String userId) {
        if (!isBoolean(definition)) return;

        if (definition.getRecurringTaskSeriesId() != null) {
            taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(
                            definition.getRecurringTaskSeriesId())
                    .stream()
                    .filter(task -> date.equals(taskDate(task)))
                    .forEach(task -> setTaskState(task, value, status));
        } else {
            List<String> taskNames = linkedTaskNames(definition);
            if (taskNames.isEmpty()) return;
            findNamedTasks(taskNames, userId, date)
                    .forEach(task -> setTaskState(task, value, status));
        }

        log.info("Linked stat occurrence synchronized to task: userId={} statDefinitionId={} date={} value={} status={}",
                userId, definition.getId(), date, value, status);
    }

    @Transactional
    public void synchronizeTaskCompletion(Task task, String userId) {
        LocalDate date = taskDate(task);
        if (date == null) return;

        Map<String, StatDefinition> definitions = linkedBooleanDefinitions(task, userId);
        if (definitions.isEmpty()) return;

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        definitions.values().forEach(definition -> {
            StatEntry entry = entryRepository
                    .findByStatDefinitionIdAndUserIdAndDate(definition.getId(), userId, date)
                    .orElseGet(() -> StatEntry.builder()
                            .id(java.util.UUID.randomUUID().toString())
                            .statDefinition(definition)
                            .date(date)
                            .user(user)
                            .build());
            entry.setValue(task.isCompleted() ? 1.0 : 0.0);
            entry.setStatus(StatEntryStatus.RECORDED);
            entryRepository.save(entry);
            log.info("Linked task completion synchronized to stat: userId={} taskId={} statDefinitionId={} date={} completed={}",
                    userId, task.getTaskId(), definition.getId(), date, task.isCompleted());
        });
    }

    /**
     * Moves an existing daily entry when a concrete occurrence is moved. If
     * the destination already has an entry, both entries are retained so a
     * user's existing day-level value is never silently overwritten.
     */
    @Transactional
    public void synchronizeTaskSchedule(Task task, LocalDate previousDate, String userId) {
        if (previousDate == null) return;

        LocalDate currentDate = taskDate(task);
        if (currentDate == null || previousDate.equals(currentDate)) return;

        linkedBooleanDefinitions(task, userId).values().forEach(definition -> {
            Optional<StatEntry> previousEntry = entryRepository
                    .findByStatDefinitionIdAndUserIdAndDate(definition.getId(), userId, previousDate);
            if (previousEntry.isEmpty() || entryRepository
                    .findByStatDefinitionIdAndUserIdAndDate(definition.getId(), userId, currentDate)
                    .isPresent()) {
                return;
            }

            StatEntry entry = previousEntry.get();
            entry.setDate(currentDate);
            entryRepository.save(entry);
            log.info("Linked stat entry moved with task occurrence: userId={} taskId={} statDefinitionId={} fromDate={} toDate={}",
                    userId, task.getTaskId(), definition.getId(), previousDate, currentDate);
        });
    }

    @Transactional(readOnly = true)
    public boolean isStatLinkedTask(Task task, String userId) {
        if (task.getTaskSeriesId() != null
                && definitionRepository.findByRecurringTaskSeriesIdAndUserId(task.getTaskSeriesId(), userId)
                .isPresent()) {
            return true;
        }
        if (task.getName() == null || task.getName().isBlank()) return false;
        if (!focusTaskLinkRepository.findAllByTaskNameAndUserIdIgnoreCase(task.getName(), userId).isEmpty()) {
            return true;
        }
        return definitionRepository.findAllByUserId(userId).stream()
                .anyMatch(definition -> definition.getFocusTaskName() != null
                        && definition.getFocusTaskName().equalsIgnoreCase(task.getName()));
    }

    @Transactional(readOnly = true)
    public boolean isStatLinkedSeries(String seriesId, String seriesName, String userId) {
        if (definitionRepository.findByRecurringTaskSeriesIdAndUserId(seriesId, userId).isPresent()) {
            return true;
        }
        if (seriesName == null || seriesName.isBlank()) return false;
        if (!focusTaskLinkRepository.findAllByTaskNameAndUserIdIgnoreCase(seriesName, userId).isEmpty()) {
            return true;
        }
        return definitionRepository.findAllByUserId(userId).stream()
                .anyMatch(definition -> definition.getFocusTaskName() != null
                        && definition.getFocusTaskName().equalsIgnoreCase(seriesName));
    }

    @Transactional
    public void synchronizeExistingEntries(StatDefinition definition, String userId) {
        if (!isLinkedBoolean(definition)) return;

        Map<LocalDate, StatEntry> entriesByDate = entryRepository
                .findAllByStatDefinitionIdAndUserId(definition.getId(), userId)
                .stream()
                .collect(Collectors.toMap(StatEntry::getDate, entry -> entry));
        taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(definition.getRecurringTaskSeriesId())
                .stream()
                // A skipped row may be an occurrence retired by the old rule;
                // applying an entry to it would resurrect it during a series edit.
                .filter(task -> !task.isSkipped())
                .filter(task -> entriesByDate.containsKey(taskDate(task)))
                .forEach(task -> {
                    StatEntry entry = entriesByDate.get(taskDate(task));
                    setTaskState(task, entry.getValue(), entry.getStatus());
                });
    }

    @EventListener
    @Transactional
    public void synchronizeChangedSeries(TaskSeriesOccurrencesChangedEvent event) {
        definitionRepository.findByRecurringTaskSeriesIdAndUserId(event.seriesId(), event.userId())
                .ifPresent(definition -> synchronizeExistingEntries(definition, event.userId()));
    }

    private boolean isLinkedBoolean(StatDefinition definition) {
        return definition != null
                && definition.getType() == StatType.BOOLEAN
                && definition.getRecurringTaskSeriesId() != null;
    }

    private boolean isBoolean(StatDefinition definition) {
        return definition != null && definition.getType() == StatType.BOOLEAN;
    }

    private Map<String, StatDefinition> linkedBooleanDefinitions(Task task, String userId) {
        Map<String, StatDefinition> definitions = new LinkedHashMap<>();

        if (task.getTaskSeriesId() != null) {
            definitionRepository.findByRecurringTaskSeriesIdAndUserId(task.getTaskSeriesId(), userId)
                    .filter(this::isBoolean)
                    .ifPresent(definition -> definitions.put(definition.getId(), definition));
        }

        if (task.getName() == null || task.getName().isBlank()) return definitions;

        focusTaskLinkRepository.findAllByTaskNameAndUserIdIgnoreCase(task.getName(), userId)
                .stream()
                .map(StatFocusTaskLink::getStatDefinition)
                .filter(this::isBoolean)
                // A recurring stat is linked by series ID. Its focus-task name
                // is for focus-time aggregation and must not link unrelated tasks.
                .filter(definition -> definition.getRecurringTaskSeriesId() == null)
                .forEach(definition -> definitions.putIfAbsent(definition.getId(), definition));

        // Older data stored only the first linked task name on the definition.
        definitionRepository.findAllByUserId(userId).stream()
                .filter(this::isBoolean)
                .filter(definition -> definition.getRecurringTaskSeriesId() == null)
                .filter(definition -> definition.getFocusTaskName() != null
                        && definition.getFocusTaskName().equalsIgnoreCase(task.getName()))
                .forEach(definition -> definitions.putIfAbsent(definition.getId(), definition));

        return definitions;
    }

    private List<String> linkedTaskNames(StatDefinition definition) {
        List<String> names = new ArrayList<>();
        if (definition.getFocusTaskName() != null && !definition.getFocusTaskName().isBlank()) {
            names.add(definition.getFocusTaskName());
        }
        focusTaskLinkRepository.findAllByStatDefinitionIdOrderByTaskNameAsc(definition.getId())
                .stream()
                .map(StatFocusTaskLink::getTaskName)
                .filter(taskName -> taskName != null && !taskName.isBlank())
                .filter(taskName -> names.stream()
                        .noneMatch(existing -> existing.equalsIgnoreCase(taskName)))
                .forEach(names::add);
        return names;
    }

    private List<Task> findNamedTasks(List<String> taskNames, String userId, LocalDate date) {
        return taskNames.stream()
                .flatMap(taskName -> taskRepository.findAllByUserIdAndNameIgnoreCase(userId, taskName).stream())
                .filter(task -> date.equals(taskDate(task)))
                .collect(Collectors.toMap(Task::getTaskId, task -> task,
                        (first, ignored) -> first, LinkedHashMap::new))
                .values()
                .stream()
                .toList();
    }

    private void setTaskState(Task task, Double value, StatEntryStatus status) {
        boolean notPlanned = status == StatEntryStatus.NOT_PLANNED;
        boolean completed = !notPlanned && value != null && value == 1.0;
        task.setCompleted(completed);
        task.setSkipped(notPlanned);
        task.setSkipReason(notPlanned ? TaskSkipReason.USER : null);
        task.setCompletionDateTime(completed ? LocalDateTime.now() : null);
        taskRepository.save(task);
    }

    private LocalDate taskDate(Task task) {
        if (task.getScheduledPerformDateTime() != null) {
            return task.getScheduledPerformDateTime().toLocalDate();
        }
        return task.getSeriesOccurrenceAt() == null ? null : task.getSeriesOccurrenceAt().toLocalDate();
    }
}
