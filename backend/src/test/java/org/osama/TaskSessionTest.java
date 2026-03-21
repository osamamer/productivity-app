package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.osama.session.task.TaskSessionRepository;
import org.osama.requests.NewTaskRequest;
import org.osama.session.task.TaskSessionService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
public class TaskSessionTest {

    private static final String TEST_USER_ID = "test-user-1";

    @Autowired
    private TaskService taskService;
    @Autowired
    private TaskSessionService taskSessionService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private TaskSessionRepository taskSessionRepository;
    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        User testUser = User.builder()
                .id(TEST_USER_ID)
                .email("test@test.com")
                .firstName("Test")
                .lastName("User")
                .username("testuser")
                .active(true)
                .build();
        userRepository.save(testUser);
    }

    @Test
    void startTaskSession() {
        Task task = createTask();
        taskSessionService.startSession(task.getTaskId(), false);
    }
    public Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setName("Do chores");
        taskRequest.setDescription("Vacuum nasty room");
        taskRequest.setScheduledPerformDateTime("2017-01-13T17:09:42.411");
        return taskService.createTask(taskRequest, TEST_USER_ID);
    }
}
