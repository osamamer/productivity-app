package org.osama.project;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.recurrence.TaskRecurrenceFrequency;
import org.osama.task.recurrence.TaskSeries;
import org.osama.task.recurrence.TaskSeriesRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class ProjectServiceTest {
    private static final String TEST_USER_ID = "project-test-user";
    private static final String OTHER_USER_ID = "project-other-user";

    @Autowired private ProjectService projectService;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskSeriesRepository taskSeriesRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager entityManager;

    @BeforeEach
    void setUp() {
        userRepository.save(user(TEST_USER_ID, "projects@test.com", "projectuser"));
        userRepository.save(user(OTHER_USER_ID, "other-projects@test.com", "otherprojectuser"));
    }

    @Test
    void createProject_trimsTheNameAndDescription() {
        ProjectResponse created = projectService.createProject(
                new CreateProjectRequest("  Website redesign  ", "  Refresh the marketing pages  "), TEST_USER_ID);

        assertEquals("Website redesign", created.name());
        assertEquals("Refresh the marketing pages", created.description());
    }

    @Test
    void createProject_requiresAName() {
        IllegalArgumentException missing = assertThrows(IllegalArgumentException.class,
                () -> projectService.createProject(new CreateProjectRequest(null, null), TEST_USER_ID));
        IllegalArgumentException blank = assertThrows(IllegalArgumentException.class,
                () -> projectService.createProject(new CreateProjectRequest("   ", null), TEST_USER_ID));

        assertEquals("Project name is required", missing.getMessage());
        assertEquals("Project name is required", blank.getMessage());
        assertEquals(0, projectRepository.findAllByUserIdOrderByNameAsc(TEST_USER_ID).size());
    }

    @Test
    void createProject_rejectsANameLongerThanTheLimit() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> projectService.createProject(
                        new CreateProjectRequest("a".repeat(ProjectService.MAX_NAME_LENGTH + 1), null), TEST_USER_ID));

        assertEquals("Project name must be 120 characters or fewer", exception.getMessage());
    }

    @Test
    void createProject_rejectsADescriptionLongerThanTheLimit() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> projectService.createProject(
                        new CreateProjectRequest("Website", "a".repeat(ProjectService.MAX_DESCRIPTION_LENGTH + 1)),
                        TEST_USER_ID));

        assertEquals("Project description must be 2000 characters or fewer", exception.getMessage());
    }

    @Test
    void createProject_treatsABlankDescriptionAsAbsent() {
        ProjectResponse created = projectService.createProject(
                new CreateProjectRequest("Website", "   "), TEST_USER_ID);

        assertNull(created.description());
    }

    @Test
    void createProject_setsCreationAndUpdateTimestamps() {
        ProjectResponse created = projectService.createProject(
                new CreateProjectRequest("Website", null), TEST_USER_ID);

        assertNotNull(created.creationDateTime());
        assertNotNull(created.updatedAt());
        assertEquals(created.creationDateTime(), created.updatedAt());
    }

    @Test
    void getProjects_returnsOnlyTheCurrentUsersProjects() {
        projectService.createProject(new CreateProjectRequest("Own project", null), TEST_USER_ID);

        assertEquals(List.of(), projectService.getProjects(OTHER_USER_ID));
    }

    @Test
    void getProjects_ordersNamesCaseInsensitively() {
        projectService.createProject(new CreateProjectRequest("banana", null), TEST_USER_ID);
        projectService.createProject(new CreateProjectRequest("Apple", null), TEST_USER_ID);
        projectService.createProject(new CreateProjectRequest("cherry", null), TEST_USER_ID);

        assertEquals(List.of("Apple", "banana", "cherry"),
                projectService.getProjects(TEST_USER_ID).stream().map(ProjectResponse::name).toList());
    }

    @Test
    void getProject_rejectsAProjectOwnedByAnotherUser() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Private project", null), TEST_USER_ID);

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> projectService.getProject(project.projectId(), OTHER_USER_ID));

        assertEquals("Project not found: " + project.projectId(), exception.getMessage());
    }

    @Test
    void updateProject_rejectsAProjectOwnedByAnotherUser() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Private project", null), TEST_USER_ID);
        UpdateProjectRequest request = new UpdateProjectRequest();
        request.setName("Hijacked");

        assertThrows(ResourceNotFoundException.class,
                () -> projectService.updateProject(project.projectId(), request, OTHER_USER_ID));
        assertEquals("Private project", projectService.getProject(project.projectId(), TEST_USER_ID).name());
    }

    @Test
    void deleteProject_rejectsAProjectOwnedByAnotherUser() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Private project", null), TEST_USER_ID);

        assertThrows(ResourceNotFoundException.class,
                () -> projectService.deleteProject(project.projectId(), OTHER_USER_ID));

        assertTrue(projectRepository.findByProjectIdAndUserId(project.projectId(), TEST_USER_ID).isPresent());
    }

    @Test
    void requireOwnedProject_rejectsAProjectOwnedByAnotherUser() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Private project", null), TEST_USER_ID);

        assertEquals(project.projectId(), projectService.requireOwnedProject(
                project.projectId(), TEST_USER_ID).getProjectId());
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> projectService.requireOwnedProject(project.projectId(), OTHER_USER_ID));
        assertEquals("Project not found: " + project.projectId(), exception.getMessage());
    }

    @Test
    void updateProject_updatesNameAndDescription() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Website", "Old description"), TEST_USER_ID);
        UpdateProjectRequest request = new UpdateProjectRequest();
        request.setName("  Renamed  ");
        request.setDescription("  New description  ");

        ProjectResponse updated = projectService.updateProject(project.projectId(), request, TEST_USER_ID);

        assertEquals("Renamed", updated.name());
        assertEquals("New description", updated.description());
    }

    @Test
    void updateProject_responseCarriesTheRefreshedUpdateTimestamp() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Website", null), TEST_USER_ID);
        UpdateProjectRequest request = new UpdateProjectRequest();
        request.setName("Renamed");

        ProjectResponse updated = projectService.updateProject(project.projectId(), request, TEST_USER_ID);

        // The response is the client's source of truth, so it must not hand back
        // the timestamp from before the update.
        assertTrue(updated.updatedAt().isAfter(project.updatedAt()));
        entityManager.flush();
        entityManager.clear();
        assertTrue(projectRepository.findByProjectIdAndUserId(project.projectId(), TEST_USER_ID)
                .orElseThrow().getUpdatedAt().isAfter(project.updatedAt()));
    }

    @Test
    void updateProject_clearsTheDescriptionWhenNullIsSent() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Website", "Old description"), TEST_USER_ID);
        UpdateProjectRequest request = new UpdateProjectRequest();
        request.setDescription(null);

        ProjectResponse updated = projectService.updateProject(project.projectId(), request, TEST_USER_ID);

        assertNull(updated.description());
        assertEquals("Website", updated.name());
        assertNull(projectRepository.findByProjectIdAndUserId(
                project.projectId(), TEST_USER_ID).orElseThrow().getDescription());
    }

    @Test
    void updateProject_rejectsABlankName() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Website", null), TEST_USER_ID);
        UpdateProjectRequest request = new UpdateProjectRequest();
        request.setName("   ");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> projectService.updateProject(project.projectId(), request, TEST_USER_ID));

        assertEquals("Project name is required", exception.getMessage());
        assertEquals("Website", projectService.getProject(project.projectId(), TEST_USER_ID).name());
    }

    @Test
    void updateRequest_distinguishesAnAbsentDescriptionFromAnExplicitNull() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        UpdateProjectRequest absent = mapper.readValue("{\"name\":\"Renamed\"}", UpdateProjectRequest.class);
        UpdateProjectRequest explicitNull = mapper.readValue("{\"description\":null}", UpdateProjectRequest.class);

        assertFalse(absent.isDescriptionPresent());
        assertTrue(absent.isNamePresent());
        assertTrue(explicitNull.isDescriptionPresent());
        assertNull(explicitNull.getDescription());
    }

    @Test
    void deleteProject_unassignsItsTasksAndKeepsThem() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Website", null), TEST_USER_ID);
        Task ownTask = saveTask(TEST_USER_ID, "Draft homepage", project.projectId(), false, false, null);
        Task otherUsersTask = saveTask(OTHER_USER_ID, "Other user's task", project.projectId(), false, false, null);

        projectService.deleteProject(project.projectId(), TEST_USER_ID);
        entityManager.flush();
        entityManager.clear();

        assertTrue(taskRepository.findTaskByTaskId(ownTask.getTaskId()).isPresent());
        assertNull(taskRepository.findTaskByTaskId(ownTask.getTaskId()).orElseThrow().getProjectId());
        assertEquals(project.projectId(),
                taskRepository.findTaskByTaskId(otherUsersTask.getTaskId()).orElseThrow().getProjectId());
        assertThrows(ResourceNotFoundException.class,
                () -> projectService.getProject(project.projectId(), TEST_USER_ID));
    }

    @Test
    void deleteProject_unassignsItsRecurringSeriesWithoutDeletingThem() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Website", null), TEST_USER_ID);
        TaskSeries series = new TaskSeries();
        series.setSeriesId(UUID.randomUUID().toString());
        series.setUser(userRepository.findUserById(TEST_USER_ID).orElseThrow());
        series.setName("Weekly review");
        series.setStartDateTime(LocalDateTime.now().plusDays(1));
        series.setRecurrenceFrequency(TaskRecurrenceFrequency.WEEKLY);
        series.setTimeZone("UTC");
        series.setProjectId(project.projectId());
        taskSeriesRepository.save(series);

        projectService.deleteProject(project.projectId(), TEST_USER_ID);
        entityManager.flush();
        entityManager.clear();

        TaskSeries unassigned = taskSeriesRepository
                .findBySeriesIdAndUserId(series.getSeriesId(), TEST_USER_ID).orElseThrow();
        assertNull(unassigned.getProjectId());
    }

    @Test
    void getProjects_countsOnlyMainNonSkippedTasksAndCompletedOnes() {
        ProjectResponse project = projectService.createProject(
                new CreateProjectRequest("Website", null), TEST_USER_ID);
        Task openTask = saveTask(TEST_USER_ID, "Draft homepage", project.projectId(), false, false, null);
        saveTask(TEST_USER_ID, "Review copy", project.projectId(), true, false, null);
        saveTask(TEST_USER_ID, "Dropped idea", project.projectId(), false, true, null);
        saveTask(TEST_USER_ID, "Collect inspiration", project.projectId(), true, false, openTask.getTaskId());
        saveTask(TEST_USER_ID, "Unassigned task", null, false, false, null);

        ProjectResponse fetched = projectService.getProject(project.projectId(), TEST_USER_ID);

        assertEquals(2, fetched.taskCount());
        assertEquals(1, fetched.completedTaskCount());
        assertEquals(fetched.taskCount(), projectService.getProjects(TEST_USER_ID).get(0).taskCount());
        assertEquals(fetched.completedTaskCount(),
                projectService.getProjects(TEST_USER_ID).get(0).completedTaskCount());
    }

    private Task saveTask(String userId, String name, String projectId,
                          boolean completed, boolean skipped, String parentId) {
        User user = userRepository.findUserById(userId).orElseThrow();
        Task task = new Task();
        task.setTaskId(UUID.randomUUID().toString());
        task.setName(name);
        task.setUser(user);
        task.setCreationDateTime(LocalDateTime.now());
        task.setDisplayOrder(0);
        task.setProjectId(projectId);
        task.setParentId(parentId);
        task.setCompleted(completed);
        task.setSkipped(skipped);
        return taskRepository.save(task);
    }

    private User user(String id, String email, String username) {
        return User.builder()
                .id(id)
                .email(email)
                .firstName("Project")
                .lastName("Test")
                .username(username)
                .active(true)
                .build();
    }
}
