package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Keeps the concrete occurrences of a statistic's task series in step with
 * the statistic entries without routing one side through the other service.
 * That separation prevents stat-to-task-to-stat update recursion.
 */
@Service
@Slf4j
public class StatTaskLinkService {

    private final StatDefinitionRepository definitionRepository;
    private final StatEntryRepository entryRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public StatTaskLinkService(StatDefinitionRepository definitionRepository,
                               StatEntryRepository entryRepository,
                               TaskRepository taskRepository,
                               UserRepository userRepository) {
        this.definitionRepository = definitionRepository;
        this.entryRepository = entryRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void synchronizeStatEntry(StatDefinition definition, LocalDate date,
                                     double value, String userId) {
        if (!isLinkedBoolean(definition)) return;

        boolean completed = value == 1.0;
        taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(definition.getRecurringTaskSeriesId())
                .stream()
                .filter(task -> task.getSeriesOccurrenceAt() != null
                        && date.equals(task.getSeriesOccurrenceAt().toLocalDate()))
                .forEach(task -> setTaskCompletion(task, completed));

        log.info("Linked stat occurrence synchronized to task: userId={} statDefinitionId={} date={} completed={}",
                userId, definition.getId(), date, completed);
    }

    @Transactional
    public void synchronizeTaskCompletion(Task task, String userId) {
        if (task.getTaskSeriesId() == null || task.getSeriesOccurrenceAt() == null) return;

        definitionRepository.findByRecurringTaskSeriesIdAndUserId(task.getTaskSeriesId(), userId)
                .filter(this::isBoolean)
                .ifPresent(definition -> {
                    User user = userRepository.findUserById(userId)
                            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
                    LocalDate date = task.getSeriesOccurrenceAt().toLocalDate();
                    StatEntry entry = entryRepository
                            .findByStatDefinitionIdAndUserIdAndDate(definition.getId(), userId, date)
                            .orElseGet(() -> StatEntry.builder()
                                    .id(java.util.UUID.randomUUID().toString())
                                    .statDefinition(definition)
                                    .date(date)
                                    .user(user)
                                    .build());
                    entry.setValue(task.isCompleted() ? 1.0 : 0.0);
                    entryRepository.save(entry);
                    log.info("Linked task completion synchronized to stat: userId={} taskId={} statDefinitionId={} date={} completed={}",
                            userId, task.getTaskId(), definition.getId(), date, task.isCompleted());
                });
    }

    @Transactional
    public void synchronizeExistingEntries(StatDefinition definition, String userId) {
        if (!isLinkedBoolean(definition)) return;

        Map<LocalDate, Double> valuesByDate = entryRepository
                .findAllByStatDefinitionIdAndUserId(definition.getId(), userId)
                .stream()
                .collect(Collectors.toMap(StatEntry::getDate, StatEntry::getValue));
        taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(definition.getRecurringTaskSeriesId())
                .stream()
                .filter(task -> task.getSeriesOccurrenceAt() != null)
                .filter(task -> valuesByDate.containsKey(task.getSeriesOccurrenceAt().toLocalDate()))
                .forEach(task -> setTaskCompletion(task,
                        valuesByDate.get(task.getSeriesOccurrenceAt().toLocalDate()) == 1.0));
    }

    private boolean isLinkedBoolean(StatDefinition definition) {
        return definition != null
                && definition.getType() == StatType.BOOLEAN
                && definition.getRecurringTaskSeriesId() != null;
    }

    private boolean isBoolean(StatDefinition definition) {
        return definition.getType() == StatType.BOOLEAN;
    }

    private void setTaskCompletion(Task task, boolean completed) {
        task.setCompleted(completed);
        task.setCompletionDateTime(completed ? LocalDateTime.now() : null);
        taskRepository.save(task);
    }
}
