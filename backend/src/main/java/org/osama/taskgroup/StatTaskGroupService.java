package org.osama.taskgroup;

import org.osama.stat.StatDefinition;
import org.osama.stat.StatDefinitionRepository;
import org.osama.stat.StatFocusTaskLink;
import org.osama.stat.StatFocusTaskLinkRepository;
import org.osama.stat.StatGroup;
import org.osama.stat.StatGroupRepository;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class StatTaskGroupService {
    private final TaskRepository taskRepository;
    private final StatDefinitionRepository definitionRepository;
    private final StatGroupRepository statGroupRepository;
    private final StatFocusTaskLinkRepository focusTaskLinkRepository;

    public StatTaskGroupService(TaskRepository taskRepository,
                                StatDefinitionRepository definitionRepository,
                                StatGroupRepository statGroupRepository,
                                StatFocusTaskLinkRepository focusTaskLinkRepository) {
        this.taskRepository = taskRepository;
        this.definitionRepository = definitionRepository;
        this.statGroupRepository = statGroupRepository;
        this.focusTaskLinkRepository = focusTaskLinkRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskGroupResponse> getGroups(String userId, List<TaskGroupResponse> regularGroups) {
        Set<String> alreadyGroupedTaskIds = new HashSet<>();
        regularGroups.forEach(group -> alreadyGroupedTaskIds.addAll(group.taskIds()));

        List<StatDefinition> definitions = definitionRepository.findAllByUserId(userId);
        Map<String, StatDefinition> definitionsById = new HashMap<>();
        Map<String, StatDefinition> definitionsBySeriesId = new HashMap<>();
        Map<String, Set<String>> definitionsByTaskName = new HashMap<>();
        definitions.forEach(definition -> {
            definitionsById.put(definition.getId(), definition);
            if (definition.getRecurringTaskSeriesId() != null) {
                definitionsBySeriesId.put(definition.getRecurringTaskSeriesId(), definition);
            }
            if (definition.getRecurringTaskSeriesId() == null) {
                addTaskName(definitionsByTaskName, definition.getFocusTaskName(), definition.getId());
            }
        });

        List<StatFocusTaskLink> focusTaskLinks = focusTaskLinkRepository.findAllByUserId(userId);
        focusTaskLinks.forEach(link -> {
            StatDefinition definition = definitionsById.get(link.getStatDefinitionId());
            if (definition != null && definition.getRecurringTaskSeriesId() == null) {
                addTaskName(definitionsByTaskName, link.getTaskName(), definition.getId());
            }
        });

        List<StatGroup> statGroups = statGroupRepository.findAllByUserIdOrderByDisplayOrderAsc(userId);
        Map<String, List<Task>> tasksByStatGroupId = new LinkedHashMap<>();
        List<Task> tasks = taskRepository.findAllByUserId(userId).stream()
                .filter(task -> (task.getParentId() == null || task.getParentId().isBlank()) && !task.isSkipped())
                .sorted(Comparator.comparingInt(Task::getDisplayOrder).thenComparing(Task::getTaskId))
                .toList();

        for (Task task : tasks) {
            if (alreadyGroupedTaskIds.contains(task.getTaskId())) continue;
            Set<String> linkedDefinitionIds = linkedDefinitionIds(task, definitionsBySeriesId,
                    definitionsByTaskName);
            if (linkedDefinitionIds.isEmpty()) continue;

            StatGroup matchingGroup = statGroups.stream()
                    .filter(group -> group.getDefinitions().stream()
                            .anyMatch(definition -> linkedDefinitionIds.contains(definition.getId())))
                    .findFirst()
                    .orElse(null);
            if (matchingGroup != null) {
                tasksByStatGroupId.computeIfAbsent(matchingGroup.getGroupId(), ignored -> new ArrayList<>())
                        .add(task);
            }
        }

        List<TaskGroupResponse> result = new ArrayList<>();
        statGroups.forEach(group -> {
            List<Task> groupTasks = tasksByStatGroupId.getOrDefault(group.getGroupId(), List.of());
            if (groupTasks.size() < 2) return;
            result.add(TaskGroupResponse.statGroup(
                    "stat-group:" + group.getGroupId(),
                    group.getName(),
                    groupTasks.stream().map(Task::getTaskId).toList(),
                    group.getDisplayOrder()));
        });
        return result;
    }

    private static Set<String> linkedDefinitionIds(Task task,
                                                   Map<String, StatDefinition> definitionsBySeriesId,
                                                   Map<String, Set<String>> definitionsByTaskName) {
        Set<String> linkedIds = new HashSet<>();
        if (task.getLinkedStatDefinitionId() != null) {
            linkedIds.add(task.getLinkedStatDefinitionId());
        }
        StatDefinition recurringDefinition = task.getTaskSeriesId() == null
                ? null
                : definitionsBySeriesId.get(task.getTaskSeriesId());
        if (recurringDefinition != null) linkedIds.add(recurringDefinition.getId());

        String normalizedTaskName = normalizeTaskName(task.getName());
        if (!normalizedTaskName.isEmpty()) {
            linkedIds.addAll(definitionsByTaskName.getOrDefault(normalizedTaskName, Set.of()));
        }
        return linkedIds;
    }

    private static void addTaskName(Map<String, Set<String>> definitionsByTaskName,
                                    String taskName,
                                    String definitionId) {
        String normalizedName = normalizeTaskName(taskName);
        if (normalizedName.isEmpty()) return;
        definitionsByTaskName.computeIfAbsent(normalizedName, ignored -> new HashSet<>()).add(definitionId);
    }

    private static String normalizeTaskName(String taskName) {
        return taskName == null ? "" : taskName.trim().toLowerCase(Locale.ROOT);
    }
}
