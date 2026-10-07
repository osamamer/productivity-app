package org.osama.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.project.Project;
import org.osama.project.ProjectRepository;
import org.osama.requests.NewTaskRequest;
import org.osama.requests.UpdateTaskRequest;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class TaskProjectAssignmentTest {
    private static final String TEST_USER_ID = "task-project-test-user";
    private static final String OTHER_USER_ID = "task-project-other-user";

    @Autowired private TaskService taskService;
    @Autowired private TaskRepository taskRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        userRepository.save(user(TEST_USER_ID, "task-projects@test.com", "taskprojectuser"));
        userRepository.save(user(OTHER_USER_ID, "other-task-projects@test.com", "othertaskprojectuser"));
    }

    @Test
    void taskCreatedWithAProjectIsReturnedWithIt() {
        Project project = project(TEST_USER_ID, "Website redesign");

        Task created = createTask(TEST_USER_ID, "Draft homepage", project.getProjectId());

        assertEquals(project.getProjectId(), created.getProjectId());
        assertEquals(project.getProjectId(),
                taskRepository.findTaskByTaskId(created.getTaskId()).orElseThrow().getProjectId());
    }

    @Test
    void taskCreatedWithoutAProjectHasNoAssignment() {
        assertNull(createTask(TEST_USER_ID, "Unassigned task", null).getProjectId());
        assertNull(createTask(TEST_USER_ID, "Blank project task", "   ").getProjectId());
    }

    @Test
    void jsonMappingDistinguishesAnAbsentProjectIdFromAnExplicitNull() throws Exception {
        UpdateTaskRequest absent = objectMapper.readValue("{\"name\":\"Rename\"}", UpdateTaskRequest.class);
        UpdateTaskRequest explicitNull = objectMapper.readValue("{\"projectId\":null}", UpdateTaskRequest.class);

        assertFalse(absent.isProjectIdPresent());
        assertTrue(explicitNull.isProjectIdPresent());
        assertNull(explicitNull.getProjectId());
    }

    @Test
    void creatingATaskWithAnUnknownProjectIsRejected() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> createTask(TEST_USER_ID, "Task", "missing-project"));

        assertEquals("Project not found: missing-project", exception.getMessage());
        assertEquals(0, taskRepository.findAllByUserId(TEST_USER_ID).size());
    }

    @Test
    void creatingATaskWithAnotherUsersProjectIsRejected() {
        Project otherUsersProject = project(OTHER_USER_ID, "Private project");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> createTask(TEST_USER_ID, "Task", otherUsersProject.getProjectId()));

        assertTrue(exception.getMessage().contains(otherUsersProject.getProjectId()));
        assertEquals(0, taskRepository.findAllByUserId(TEST_USER_ID).size());
    }

    @Test
    void updatingATaskWithAnUnknownProjectIsRejected() {
        Task task = createTask(TEST_USER_ID, "Task", null);

        assertThrows(IllegalArgumentException.class,
                () -> taskService.updateTask(task.getTaskId(), updateProject("missing-project"), TEST_USER_ID));

        assertNull(taskRepository.findTaskByTaskId(task.getTaskId()).orElseThrow().getProjectId());
    }

    @Test
    void updatingATaskWithAnotherUsersProjectIsRejected() {
        Project otherUsersProject = project(OTHER_USER_ID, "Private project");
        Task task = createTask(TEST_USER_ID, "Task", null);

        assertThrows(IllegalArgumentException.class,
                () -> taskService.updateTask(task.getTaskId(), updateProject(otherUsersProject.getProjectId()),
                        TEST_USER_ID));

        assertNull(taskRepository.findTaskByTaskId(task.getTaskId()).orElseThrow().getProjectId());
    }

    @Test
    void updatingWithExplicitNullProjectIdClearsTheAssignment() {
        Project project = project(TEST_USER_ID, "Website redesign");
        Task task = createTask(TEST_USER_ID, "Draft homepage", project.getProjectId());

        Task updated = taskService.updateTask(task.getTaskId(), updateProject(null), TEST_USER_ID).orElseThrow();

        assertNull(updated.getProjectId());
        assertNull(taskRepository.findTaskByTaskId(task.getTaskId()).orElseThrow().getProjectId());
    }

    @Test
    void updatingWithABlankProjectIdClearsTheAssignment() {
        Project project = project(TEST_USER_ID, "Website redesign");
        Task task = createTask(TEST_USER_ID, "Draft homepage", project.getProjectId());

        Task updated = taskService.updateTask(task.getTaskId(), updateProject("  "), TEST_USER_ID).orElseThrow();

        assertNull(updated.getProjectId());
    }

    @Test
    void updatingWithoutAProjectIdLeavesTheAssignmentUnchanged() {
        Project project = project(TEST_USER_ID, "Website redesign");
        Task task = createTask(TEST_USER_ID, "Draft homepage", project.getProjectId());

        UpdateTaskRequest rename = new UpdateTaskRequest();
        rename.setName("Draft landing page");
        Task updated = taskService.updateTask(task.getTaskId(), rename, TEST_USER_ID).orElseThrow();

        assertEquals("Draft landing page", updated.getName());
        assertEquals(project.getProjectId(), updated.getProjectId());
    }

    @Test
    void findTasksWithAProjectIdReturnsOnlyThatProjectsMainNonSkippedTasks() {
        Project targetProject = project(TEST_USER_ID, "Website redesign");
        Project otherProject = project(TEST_USER_ID, "Home move");
        Task first = createTask(TEST_USER_ID, "Draft homepage", targetProject.getProjectId());
        Task second = createTask(TEST_USER_ID, "Review copy", targetProject.getProjectId());
        createSubtask(first, "Collect inspiration", targetProject.getProjectId());
        Task skipped = createTask(TEST_USER_ID, "Dropped idea", targetProject.getProjectId());
        skipped.setSkipped(true);
        taskRepository.save(skipped);
        createTask(TEST_USER_ID, "Book movers", otherProject.getProjectId());
        createTask(TEST_USER_ID, "Unassigned task", null);

        List<Task> tasks = taskService.findTasks(TaskQuery.builder()
                .userId(TEST_USER_ID)
                .projectId(targetProject.getProjectId())
                .build());

        assertEquals(Set.of(first.getTaskId(), second.getTaskId()),
                tasks.stream().map(Task::getTaskId).collect(Collectors.toSet()));
        assertTrue(tasks.stream().allMatch(task -> task.getParentId() == null));
        assertFalse(tasks.stream().anyMatch(Task::isSkipped));
    }

    private Task createTask(String userId, String name, String projectId) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setProjectId(projectId);
        return taskService.createTask(request, userId);
    }

    private Task createSubtask(Task parent, String name, String projectId) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setParentId(parent.getTaskId());
        request.setProjectId(projectId);
        return taskService.createTask(request, TEST_USER_ID);
    }

    private UpdateTaskRequest updateProject(String projectId) {
        UpdateTaskRequest request = new UpdateTaskRequest();
        request.setProjectId(projectId);
        return request;
    }

    private Project project(String userId, String name) {
        User user = userRepository.findUserById(userId).orElseThrow();
        return projectRepository.save(Project.builder()
                .projectId(UUID.randomUUID().toString())
                .user(user)
                .name(name)
                .build());
    }

    private User user(String id, String email, String username) {
        return User.builder()
                .id(id)
                .email(email)
                .firstName("Task")
                .lastName("Project")
                .username(username)
                .active(true)
                .build();
    }
}
