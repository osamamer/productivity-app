package org.osama.project;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatDefinitionRepository;
import org.osama.stat.StatEntry;
import org.osama.stat.StatEntryRepository;
import org.osama.stat.StatEntryStatus;
import org.osama.stat.StatMorality;
import org.osama.stat.StatType;
import org.osama.task.TaskRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CheckpointService {
    public static final int MAX_NAME_LENGTH = 120;

    private final CheckpointRepository checkpointRepository;
    private final ProjectRepository projectRepository;
    private final StatDefinitionRepository definitionRepository;
    private final StatEntryRepository entryRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<CheckpointResponse> getCheckpoints(String projectId, LocalDate today, String userId) {
        findProject(projectId, userId);
        return describe(List.of(projectId), today, userId).getOrDefault(projectId, List.of());
    }

    @Transactional
    public CheckpointResponse createCheckpoint(String projectId, CheckpointRequest request, LocalDate today, String userId) {
        Project project = findProject(projectId, userId);
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        Checkpoint checkpoint = new Checkpoint();
        checkpoint.setId(UUID.randomUUID().toString());
        checkpoint.setProjectId(projectId);
        checkpoint.setUser(user);
        checkpoint.setName(validateName(request.getName()));
        checkpoint.setTargetDate(request.getTargetDate());
        checkpoint.setDisplayOrder(request.getDisplayOrder() != null
                ? request.getDisplayOrder()
                : (int) checkpointRepository.countByProjectIdAndUserId(projectId, userId));
        if (request.getStatDefinitionId() == null) throw new IllegalArgumentException("A checkpoint needs a stat to measure.");
        if (request.getAggregation() == null) throw new IllegalArgumentException("Choose how the checkpoint's stat is measured.");
        if (request.getTargetValue() == null) throw new IllegalArgumentException("A checkpoint needs a target.");
        applyMetric(checkpoint, request, userId);
        checkpoint.setCountFrom(request.getCountFrom() != null ? request.getCountFrom() : project.getCreationDateTime().toLocalDate());
        checkpointRepository.save(checkpoint);
        log.info("Checkpoint created: userId={} projectId={} checkpointId={}", userId, projectId, checkpoint.getId());
        return describeOne(checkpoint, today, userId);
    }

    @Transactional
    public CheckpointResponse updateCheckpoint(String projectId, String checkpointId, CheckpointRequest request,
                                               LocalDate today, String userId) {
        Checkpoint checkpoint = findInProject(projectId, checkpointId, userId);
        if (request.getName() != null) checkpoint.setName(validateName(request.getName()));
        if (request.isTargetDatePresent()) checkpoint.setTargetDate(request.getTargetDate());
        if (request.getDisplayOrder() != null) checkpoint.setDisplayOrder(request.getDisplayOrder());
        if (request.getCountFrom() != null) checkpoint.setCountFrom(request.getCountFrom());
        applyMetric(checkpoint, request, userId);
        checkpointRepository.saveAndFlush(checkpoint);
        log.info("Checkpoint updated: userId={} checkpointId={}", userId, checkpointId);
        return describeOne(checkpoint, today, userId);
    }

    /** Deletes the checkpoint; its tasks stay in the project without one. */
    @Transactional
    public void deleteCheckpoint(String projectId, String checkpointId, String userId) {
        Checkpoint checkpoint = findInProject(projectId, checkpointId, userId);
        int cleared = taskRepository.clearCheckpointAssignments(checkpointId, userId);
        checkpointRepository.delete(checkpoint);
        log.info("Checkpoint deleted: userId={} checkpointId={} tasksCleared={}", userId, checkpointId, cleared);
    }

    /** Checkpoints with progress per project id, in display order. */
    @Transactional(readOnly = true)
    public Map<String, List<CheckpointResponse>> describe(Collection<String> projectIds, LocalDate today, String userId) {
        if (projectIds.isEmpty()) return Map.of();
        List<Checkpoint> checkpoints = checkpointRepository.findAllByProjectIdInAndUserIdOrderByDisplayOrderAsc(projectIds, userId);
        Map<String, StatDefinition> definitions = definitionRepository.findAllById(
                        checkpoints.stream().map(Checkpoint::getStatDefinitionId).distinct().toList()).stream()
                .filter(definition -> definition.getUser() != null && userId.equals(definition.getUser().getId()))
                .collect(Collectors.toMap(StatDefinition::getId, Function.identity()));
        Map<String, TaskRepository.CheckpointTaskCount> counts = checkpoints.isEmpty() ? Map.of()
                : taskRepository.countTasksByCheckpointIds(userId, checkpoints.stream().map(Checkpoint::getId).toList()).stream()
                .collect(Collectors.toMap(TaskRepository.CheckpointTaskCount::getCheckpointId, Function.identity()));
        Map<String, List<StatEntry>> entries = new HashMap<>();
        Map<String, List<CheckpointResponse>> byProject = new LinkedHashMap<>();
        for (Checkpoint checkpoint : checkpoints) {
            StatDefinition definition = definitions.get(checkpoint.getStatDefinitionId());
            List<StatEntry> statEntries = definition == null ? List.of() : entries.computeIfAbsent(definition.getId(),
                    id -> entryRepository.findAllByStatDefinitionIdAndUserId(id, userId));
            byProject.computeIfAbsent(checkpoint.getProjectId(), id -> new ArrayList<>())
                    .add(toResponse(checkpoint, definition, statEntries, counts.get(checkpoint.getId()), today));
        }
        return byProject;
    }

    private CheckpointResponse describeOne(Checkpoint checkpoint, LocalDate today, String userId) {
        return describe(List.of(checkpoint.getProjectId()), today, userId).get(checkpoint.getProjectId()).stream()
                .filter(response -> response.id().equals(checkpoint.getId()))
                .findFirst()
                .orElseThrow();
    }

    private static CheckpointResponse toResponse(Checkpoint checkpoint, StatDefinition definition, List<StatEntry> entries,
                                                 TaskRepository.CheckpointTaskCount count, LocalDate today) {
        boolean falling = definition != null && checkpoint.getAggregation() == CheckpointAggregation.LATEST && isLessBetter(definition);
        CheckpointMetric metric = new CheckpointMetric(checkpoint.getAggregation(), checkpoint.getCountFrom(),
                checkpoint.getBaseline(), checkpoint.getTargetValue(), falling);
        CheckpointProgress progress = definition == null
                ? new CheckpointProgress(null, 0, null)
                : CheckpointProgress.measure(metric, loggedValues(entries, checkpoint.getValueSource()), today);
        return new CheckpointResponse(checkpoint.getId(), checkpoint.getProjectId(), checkpoint.getName(),
                checkpoint.getTargetDate(), checkpoint.getDisplayOrder(),
                new CheckpointResponse.Metric(checkpoint.getStatDefinitionId(),
                        definition == null ? null : definition.getName(),
                        definition == null ? null : definition.getUnit(),
                        checkpoint.getValueSource(),
                        definition == null ? null : valueType(definition, checkpoint.getValueSource()),
                        checkpoint.getAggregation(), checkpoint.getCountFrom(), checkpoint.getBaseline(),
                        checkpoint.getTargetValue(), falling),
                progress.current(), progress.fraction(), progress.reachedOn(),
                count == null ? 0 : count.getTaskCount(), count == null ? 0 : count.getCompletedTaskCount());
    }

    /** Recorded values per day; not-planned days and days without the chosen input are left out. */
    public static Map<LocalDate, Double> loggedValues(List<StatEntry> entries, String valueSource) {
        Map<LocalDate, Double> values = new HashMap<>();
        boolean mainValue = Checkpoint.MAIN_VALUE.equals(valueSource);
        StatType additional = mainValue ? null : StatType.valueOf(valueSource);
        for (StatEntry entry : entries) {
            if (entry.getStatus() == StatEntryStatus.NOT_PLANNED) continue;
            Double value = mainValue ? Double.valueOf(entry.getValue()) : entry.getAdditionalValues().get(additional);
            if (value != null) values.put(entry.getDate(), value);
        }
        return values;
    }

    private void applyMetric(Checkpoint checkpoint, CheckpointRequest request, String userId) {
        if (request.getStatDefinitionId() != null) {
            StatDefinition definition = definitionRepository.findByIdAndUserId(request.getStatDefinitionId(), userId)
                    .orElseThrow(() -> new IllegalArgumentException("Stat not found: " + request.getStatDefinitionId()));
            checkpoint.setStatDefinitionId(definition.getId());
            checkpoint.setValueSource(validateSource(definition, request.getValueSource()));
        } else if (request.getValueSource() != null) {
            StatDefinition definition = definitionRepository.findByIdAndUserId(checkpoint.getStatDefinitionId(), userId)
                    .orElseThrow(() -> new IllegalArgumentException("The checkpoint's stat no longer exists."));
            checkpoint.setValueSource(validateSource(definition, request.getValueSource()));
        }
        if (request.getAggregation() != null) checkpoint.setAggregation(request.getAggregation());
        if (request.getTargetValue() != null) checkpoint.setTargetValue(finite(request.getTargetValue(), "target"));
        if (request.getBaseline() != null) checkpoint.setBaseline(finite(request.getBaseline(), "baseline"));
    }

    private static String validateSource(StatDefinition definition, String requested) {
        if (requested == null || requested.isBlank() || Checkpoint.MAIN_VALUE.equals(requested)) return Checkpoint.MAIN_VALUE;
        boolean offered = definition.getAdditionalInputTypes().stream().anyMatch(type -> type.name().equals(requested));
        if (!offered) throw new IllegalArgumentException("That stat has no " + requested + " input.");
        return requested;
    }

    private static double finite(Double value, String field) {
        if (!Double.isFinite(value)) throw new IllegalArgumentException("The " + field + " must be a number.");
        return value;
    }

    static StatType valueType(StatDefinition definition, String valueSource) {
        return Checkpoint.MAIN_VALUE.equals(valueSource) ? definition.getType() : StatType.valueOf(valueSource);
    }

    private static boolean isLessBetter(StatDefinition definition) {
        return definition.getMorality() == StatMorality.BAD || definition.getMorality() == StatMorality.NICE_TO_AVOID;
    }

    private Project findProject(String projectId, String userId) {
        return projectRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
    }

    private Checkpoint findInProject(String projectId, String checkpointId, String userId) {
        return checkpointRepository.findByIdAndUserId(checkpointId, userId)
                .filter(checkpoint -> checkpoint.getProjectId().equals(projectId))
                .orElseThrow(() -> new ResourceNotFoundException("Checkpoint not found: " + checkpointId));
    }

    private static String validateName(String name) {
        String normalized = name == null ? "" : name.trim();
        if (normalized.isEmpty() || normalized.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Checkpoint name must contain between 1 and 120 characters.");
        }
        return normalized;
    }
}
