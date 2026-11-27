package org.osama.path;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.project.CheckpointResponse;
import org.osama.project.CheckpointService;
import org.osama.project.CreateProjectRequest;
import org.osama.project.Project;
import org.osama.project.ProjectDeletedEvent;
import org.osama.project.ProjectRepository;
import org.osama.project.ProjectResponse;
import org.osama.project.ProjectService;
import org.osama.project.UpdateProjectRequest;
import org.osama.task.TaskRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MilestoneService {
    private final MilestoneRepository milestoneRepository;
    private final PathRepository pathRepository;
    private final ProjectService projectService;
    private final ProjectRepository projectRepository;
    private final CheckpointService checkpointService;
    private final TaskRepository taskRepository;

    /** Creates the milestone and the project it ends. */
    @Transactional
    public MilestoneResponse createMilestone(String pathId, MilestoneRequest request, LocalDate today, String userId) {
        requirePath(pathId, userId);
        ProjectResponse project = projectService.createProject(new CreateProjectRequest(request.getName(), null), userId);
        Milestone milestone = new Milestone();
        milestone.setId(UUID.randomUUID().toString());
        milestone.setPathId(pathId);
        milestone.setProjectId(project.projectId());
        milestone.setTargetDate(request.getTargetDate());
        milestone.setDisplayOrder(request.getDisplayOrder() != null
                ? request.getDisplayOrder()
                : (int) milestoneRepository.countByPathId(pathId));
        milestoneRepository.save(milestone);
        if (Boolean.TRUE.equals(request.getDone())) projectService.setCompleted(project.projectId(), true, userId);
        log.info("Milestone created: userId={} pathId={} milestoneId={} projectId={}",
                userId, pathId, milestone.getId(), project.projectId());
        return describeOne(milestone, today, userId);
    }

    @Transactional
    public MilestoneResponse updateMilestone(String pathId, String milestoneId, MilestoneRequest request,
                                             LocalDate today, String userId) {
        Milestone milestone = findOwned(pathId, milestoneId, userId);
        if (request.getName() != null) {
            UpdateProjectRequest rename = new UpdateProjectRequest();
            rename.setName(request.getName());
            projectService.updateProject(milestone.getProjectId(), rename, userId);
        }
        if (request.isTargetDatePresent()) milestone.setTargetDate(request.getTargetDate());
        if (request.getDisplayOrder() != null) milestone.setDisplayOrder(request.getDisplayOrder());
        if (request.getDone() != null) projectService.setCompleted(milestone.getProjectId(), request.getDone(), userId);
        milestoneRepository.saveAndFlush(milestone);
        log.info("Milestone updated: userId={} milestoneId={}", userId, milestoneId);
        return describeOne(milestone, today, userId);
    }

    /** Deletes the milestone and its project; the project's tasks stay, unassigned. */
    @Transactional
    public void deleteMilestone(String pathId, String milestoneId, String userId) {
        Milestone milestone = findOwned(pathId, milestoneId, userId);
        projectService.deleteProject(milestone.getProjectId(), userId);
        milestoneRepository.findById(milestoneId).ifPresent(milestoneRepository::delete);
        log.info("Milestone deleted: userId={} milestoneId={}", userId, milestoneId);
    }

    @Transactional
    public void deleteAllOfPath(String pathId, String userId) {
        milestoneRepository.findAllByPathIdOrderByDisplayOrderAsc(pathId)
                .forEach(milestone -> deleteMilestone(pathId, milestone.getId(), userId));
    }

    /** A project deleted elsewhere takes its milestone with it. */
    @EventListener
    public void onProjectDeleted(ProjectDeletedEvent event) {
        milestoneRepository.findByProjectId(event.projectId()).ifPresent(milestone -> {
            milestoneRepository.delete(milestone);
            log.info("Milestone removed with its project: userId={} milestoneId={} projectId={}",
                    event.userId(), milestone.getId(), event.projectId());
        });
    }

    /** Milestones per path id, in display order, with progress measured on {@code today}. */
    @Transactional(readOnly = true)
    public Map<String, List<MilestoneResponse>> describe(Collection<String> pathIds, LocalDate today, String userId) {
        if (pathIds.isEmpty()) return Map.of();
        List<Milestone> milestones = milestoneRepository.findAllByPathIdInOrderByDisplayOrderAsc(pathIds);
        List<String> projectIds = milestones.stream().map(Milestone::getProjectId).toList();
        Map<String, Project> projects = projectRepository.findAllById(projectIds).stream()
                .filter(project -> project.getUser() != null && userId.equals(project.getUser().getId()))
                .collect(Collectors.toMap(Project::getProjectId, Function.identity()));
        Map<String, List<CheckpointResponse>> checkpoints = checkpointService.describe(projectIds, today, userId);
        Map<String, TaskRepository.ProjectTaskCount> counts = projectIds.isEmpty() ? Map.of()
                : taskRepository.countTasksByProjectIds(userId, projectIds).stream()
                .collect(Collectors.toMap(TaskRepository.ProjectTaskCount::getProjectId, Function.identity()));
        Map<String, List<MilestoneResponse>> byPath = new LinkedHashMap<>();
        for (Milestone milestone : milestones) {
            Project project = projects.get(milestone.getProjectId());
            if (project == null) continue;
            byPath.computeIfAbsent(milestone.getPathId(), id -> new ArrayList<>()).add(toResponse(milestone, project,
                    checkpoints.getOrDefault(milestone.getProjectId(), List.of()), counts.get(milestone.getProjectId())));
        }
        return byPath;
    }

    static MilestoneResponse toResponse(Milestone milestone, Project project, List<CheckpointResponse> checkpoints,
                                        TaskRepository.ProjectTaskCount count) {
        long tasks = count == null ? 0 : count.getTaskCount();
        long completedTasks = count == null ? 0 : count.getCompletedTaskCount();
        boolean allReached = !checkpoints.isEmpty() && checkpoints.stream().allMatch(checkpoint -> checkpoint.reachedOn() != null);
        LocalDate doneOn = project.getCompletedAt() != null
                ? project.getCompletedAt().toLocalDate()
                : allReached ? checkpoints.stream().map(CheckpointResponse::reachedOn).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(null) : null;
        boolean done = doneOn != null;
        double progress = done ? 1
                : !checkpoints.isEmpty() ? checkpoints.stream().mapToDouble(CheckpointResponse::progress).average().orElse(0)
                : tasks > 0 ? (double) completedTasks / tasks : 0;
        return new MilestoneResponse(milestone.getId(), milestone.getProjectId(), project.getName(), milestone.getTargetDate(),
                milestone.getDisplayOrder(), done, doneOn, progress, tasks, completedTasks, checkpoints);
    }

    private MilestoneResponse describeOne(Milestone milestone, LocalDate today, String userId) {
        return describe(List.of(milestone.getPathId()), today, userId).getOrDefault(milestone.getPathId(), List.of()).stream()
                .filter(response -> response.id().equals(milestone.getId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found: " + milestone.getId()));
    }

    private void requirePath(String pathId, String userId) {
        pathRepository.findByIdAndUserId(pathId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Path not found: " + pathId));
    }

    private Milestone findOwned(String pathId, String milestoneId, String userId) {
        requirePath(pathId, userId);
        return milestoneRepository.findByIdAndPathId(milestoneId, pathId)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found: " + milestoneId));
    }
}
