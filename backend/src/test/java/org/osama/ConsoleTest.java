package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.osama.day.DayService;
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

@SpringBootTest
@ActiveProfiles("test")
public class ConsoleTest {

    private static final String TEST_USER_ID = "test-user-1";

    @Autowired
    private TaskService taskService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private TaskSessionRepository taskSessionRepository;
    @Autowired
    private DayService dayService;
    @Autowired
    private TaskSessionService taskSessionService;
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
    void main() throws InterruptedException {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Task one");
        request.setDescription("Task one description");
        request.setScheduledPerformDateTime("2017-01-13T17:09:42.411");
        Task task = taskService.createTask(request, TEST_USER_ID);
        String taskId = task.getTaskId();
        taskSessionService.startSession(taskId, false);
        Thread.sleep(25);
        taskSessionService.pauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.unpauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.pauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.unpauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.endSession(taskId);
        System.out.println(taskService.getAccumulatedTime(taskId).toMillis() + " milliseconds");
    }
    @Test
    void test() throws InterruptedException {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Task one");
        request.setDescription("Task one description");
        request.setScheduledPerformDateTime("2017-01-13T17:09:42.411");

        Task task = taskService.createTask(request, TEST_USER_ID);
        String taskId = task.getTaskId();
        taskSessionService.startSession(taskId, false);
        Thread.sleep(50);
        taskSessionService.pauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.endSession(taskId);
        System.out.println(taskService.getAccumulatedTime(taskId).toMillis() + " milliseconds");
    }
    public void pauseSession(String taskId){
        taskSessionService.pauseSession(taskId);
    }
}
