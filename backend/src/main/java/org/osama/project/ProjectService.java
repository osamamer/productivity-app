package org.osama.project;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.task.TaskRepository;
import org.osama.task.recurrence.TaskSeriesRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ProjectService {
    public static final int MAX_NAME_LENGTH = 120;
    public static final int MAX_DESCRIPTION_LENGTH = 2000;
    private static final String DEFAULT_COLOR = "blue";
    private static final String DEFAULT_ICON = "folder";
    private static final Set<String> ALLOWED_COLORS = Set.of("blue", "violet", "teal", "amber", "rose");
    private static final Set<String> ALLOWED_ICONS = Set.of("folder", "rocket", "lightbulb", "book", "home", "leaf");

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final TaskSeriesRepository taskSeriesRepository;
    private final UserRepository userRepository;

    public ProjectService(ProjectRepository projectRepository,
                          TaskRepository taskRepository,
                          TaskSeriesRepository taskSeriesRepository,
                          UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.taskSeriesRepository = taskSeriesRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> getProjects(String userId) {
        List<Project> projects = projectRepository.findAllByUserIdOrderByNameAsc(userId);
        if (projects.isEmpty()) {
            return List.of();
        }

        Map<String, TaskRepository.ProjectTaskCount> counts = taskRepository
                .countTasksByProjectIds(userId, projects.stream().map(Project::getProjectId).toList())
                .stream()
                .collect(Collectors.toMap(TaskRepository.ProjectTaskCount::getProjectId, Function.identity()));

        return projects.stream()
                .map(project -> {
                    TaskRepository.ProjectTaskCount count = counts.get(project.getProjectId());
                    return ProjectResponse.from(project,
                            count == null ? 0 : count.getTaskCount(),
                            count == null ? 0 : count.getCompletedTaskCount());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProject(String projectId, String userId) {
        return toResponse(findOwnedProject(projectId, userId), userId);
    }

    @Transactional
    public ProjectResponse createProject(CreateProjectRequest request, String userId) {
        String name = validateName(request.name());
        String description = normalizeDescription(request.description());
        String color = validateChoice(request.color(), DEFAULT_COLOR, ALLOWED_COLORS, "color");
        String icon = validateChoice(request.icon(), DEFAULT_ICON, ALLOWED_ICONS, "icon");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        Project project = Project.builder()
                .projectId(UUID.randomUUID().toString())
                .user(user)
                .name(name)
                .description(description)
                .color(color)
                .icon(icon)
                .build();
        // Assigned ids make Spring Data merge, so only the managed copy receives the
        // @PrePersist timestamps.
        Project saved = projectRepository.save(project);
        log.info("Project created: userId={} projectId={} color={} icon={}",
                userId, saved.getProjectId(), saved.getColor(), saved.getIcon());
        return ProjectResponse.from(saved, 0, 0);
    }

    @Transactional
    public ProjectResponse updateProject(String projectId, UpdateProjectRequest request, String userId) {
        Project project = findOwnedProject(projectId, userId);
        boolean changed = false;

        if (request.isNamePresent()) {
            project.setName(validateName(request.getName()));
            changed = true;
        }
        if (request.isDescriptionPresent()) {
            project.setDescription(normalizeDescription(request.getDescription()));
            changed = true;
        }
        if (request.isColorPresent()) {
            project.setColor(validateChoice(request.getColor(), null, ALLOWED_COLORS, "color"));
            changed = true;
        }
        if (request.isIconPresent()) {
            project.setIcon(validateChoice(request.getIcon(), null, ALLOWED_ICONS, "icon"));
            changed = true;
        }

        if (changed) {
            // Flush here so the response carries the @PreUpdate timestamp; the
            // Task count query below does not auto-flush a pending Project change.
            projectRepository.saveAndFlush(project);
            log.info("Project updated: userId={} projectId={} color={} icon={}",
                    userId, projectId, project.getColor(), project.getIcon());
        }
        return toResponse(project, userId);
    }

    @Transactional
    public void deleteProject(String projectId, String userId) {
        Project project = findOwnedProject(projectId, userId);
        taskRepository.clearProjectAssignments(projectId, userId);
        taskSeriesRepository.clearProjectAssignments(projectId, userId);
        projectRepository.delete(project);
        log.info("Project deleted: userId={} projectId={}", userId, projectId);
    }

    @Transactional(readOnly = true)
    public Project requireOwnedProject(String projectId, String userId) {
        return projectRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
    }

    private Project findOwnedProject(String projectId, String userId) {
        return projectRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
    }

    private ProjectResponse toResponse(Project project, String userId) {
        List<TaskRepository.ProjectTaskCount> counts =
                taskRepository.countTasksByProjectIds(userId, List.of(project.getProjectId()));
        if (counts.isEmpty()) {
            return ProjectResponse.from(project, 0, 0);
        }

        TaskRepository.ProjectTaskCount count = counts.get(0);
        return ProjectResponse.from(project, count.getTaskCount(), count.getCompletedTaskCount());
    }

    private String validateName(String name) {
        String normalized = name == null ? null : name.trim();
        if (normalized == null || normalized.isEmpty()) {
            throw new IllegalArgumentException("Project name is required");
        }
        if (normalized.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Project name must be 120 characters or fewer");
        }
        return normalized;
    }

    private String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }

        String normalized = description.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > MAX_DESCRIPTION_LENGTH) {
            throw new IllegalArgumentException("Project description must be 2000 characters or fewer");
        }
        return normalized;
    }

    private String validateChoice(String value, String defaultValue, Set<String> allowedValues, String fieldName) {
        if (value == null && defaultValue != null) return defaultValue;
        String normalized = value == null ? null : value.trim().toLowerCase(Locale.ROOT);
        if (normalized == null || !allowedValues.contains(normalized)) {
            throw new IllegalArgumentException("Project " + fieldName + " is invalid");
        }
        return normalized;
    }
}
