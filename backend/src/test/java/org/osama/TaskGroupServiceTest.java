package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.requests.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.osama.taskgroup.TaskGroupResponse;
import org.osama.taskgroup.TaskGroupService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class TaskGroupServiceTest {
    private static final String TEST_USER_ID = "task-group-test-user";
    private static final String OTHER_USER_ID = "task-group-other-user";

    @Autowired private TaskGroupService taskGroupService;
    @Autowired private TaskService taskService;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(user(TEST_USER_ID, "groups@test.com", "groupuser"));
        userRepository.save(user(OTHER_USER_ID, "other-groups@test.com", "othergroupuser"));
    }

    @Test
    void reorderMainTasks_persistsTheSubmittedRelativeOrder() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");
        Task third = createTask(TEST_USER_ID, "Third");

        taskService.reorderMainTasks(List.of(third.getTaskId(), first.getTaskId(), second.getTaskId()), TEST_USER_ID);

        assertEquals(
                List.of(third.getTaskId(), first.getTaskId(), second.getTaskId()),
                taskService.getTodayTasks(TEST_USER_ID).stream().map(Task::getTaskId).toList()
        );
    }

    @Test
    void createGroup_roundTripsMembershipWithoutMakingTasksSubtasks() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");

        TaskGroupResponse created = taskGroupService.createGroup(
                "Morning routine", List.of(first.getTaskId(), second.getTaskId()), TEST_USER_ID);

        assertEquals("Morning routine", created.name());
        assertEquals(List.of(first.getTaskId(), second.getTaskId()), created.taskIds());
        assertNull(first.getParentId());
        assertEquals(1, taskGroupService.getGroups(TEST_USER_ID).size());
    }

    @Test
    void createGroup_rejectsTasksOwnedByAnotherUser() {
        Task ownTask = createTask(TEST_USER_ID, "Own task");
        Task otherTask = createTask(OTHER_USER_ID, "Other task");

        assertThrows(IllegalArgumentException.class, () -> taskGroupService.createGroup(
                "Invalid group", List.of(ownTask.getTaskId(), otherTask.getTaskId()), TEST_USER_ID));
    }

    @Test
    void createGroup_movesTasksOutOfTheirPreviousGroup() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");
        Task third = createTask(TEST_USER_ID, "Third");
        Task fourth = createTask(TEST_USER_ID, "Fourth");
        taskGroupService.createGroup(
                "Original", List.of(first.getTaskId(), second.getTaskId(), third.getTaskId()), TEST_USER_ID);

        taskGroupService.createGroup(
                "Regrouped", List.of(second.getTaskId(), fourth.getTaskId()), TEST_USER_ID);

        List<TaskGroupResponse> groups = taskGroupService.getGroups(TEST_USER_ID);
        assertEquals(2, groups.size());
        assertEquals(List.of(first.getTaskId(), third.getTaskId()), groups.get(0).taskIds());
        assertEquals(List.of(second.getTaskId(), fourth.getTaskId()), groups.get(1).taskIds());
    }

    private Task createTask(String userId, String name) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setScheduledPerformDateTime(LocalDate.now().atTime(9, 0).toString());
        return taskService.createTask(request, userId);
    }

    private User user(String id, String email, String username) {
        return User.builder()
                .id(id)
                .email(email)
                .firstName("Task")
                .lastName("Group")
                .username(username)
                .active(true)
                .build();
    }
}
