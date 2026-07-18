package org.osama;

import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.pomodoro.PomodoroRepository;
import org.osama.pomodoro.PomodoroService;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.TimedExecutorService;
import org.osama.requests.NewTaskRequest;
import org.osama.session.task.TaskSessionService;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
@Execution(ExecutionMode.SAME_THREAD)
public class PomoTest {

    private static final String TEST_USER_ID = "test-user-1";

    @Autowired
    private TimedExecutorService timedExecutorService;
    @Autowired
    private ScheduledJobRepository scheduledJobRepository;
    @Autowired
    private TaskService taskService;
    @Autowired
    private TaskSessionService taskSessionService;
    @Autowired
    private PomodoroService pomodoroService;
    @Autowired
    private PomodoroRepository pomodoroRepository;
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
    void pomoSchedulingLogicWorks() throws InterruptedException {
        Task task = createTask();
        int focusDuration = 5;
        int shortBreakDuration = 1;
        int longBreakDuration = 2;
        int numFocuses = 3;
        int longBreakCooldown = 2;
        pomodoroService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown, TEST_USER_ID);
    }

    @Test
    void userCannotStartPomodoroForAnotherUsersTask() {
        Task task = createTask();
        User otherUser = User.builder()
                .id("test-user-2")
                .email("other@test.com")
                .firstName("Other")
                .lastName("User")
                .username("otheruser")
                .active(true)
                .build();
        userRepository.save(otherUser);

        assertThrows(ResourceNotFoundException.class,
                () -> pomodoroService.startPomodoro(task.getTaskId(), 25, 5, 15, 4, 4, otherUser.getId()));
        assertFalse(pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(task.getTaskId()).isPresent());
        assertTrue(scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).isEmpty());
    }

    @Test
    void invalidPomodoroSettingsDoNotCreatePartialState() {
        Task task = createTask();

        assertThrows(IllegalArgumentException.class,
                () -> pomodoroService.startPomodoro(task.getTaskId(), 0, 5, 15, 4, 4, TEST_USER_ID));
        assertFalse(pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(task.getTaskId()).isPresent());
        assertTrue(scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).isEmpty());
    }
    @Test
    void pomoUserInterventionTest() throws InterruptedException {
        Task task = createTask();
        int focusDuration = 5;
        int shortBreakDuration = 1;
        int longBreakDuration = 2;
        int numFocuses = 3;
        int longBreakCooldown = 2;
        long pauseTime = 1000;
        pomodoroService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown, TEST_USER_ID);
        List<LocalDateTime> oldDueDates = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream().map(ScheduledJob::getDueDate).toList();;
        Thread.sleep(1000);
        taskSessionService.pauseSession(task.getTaskId());
        Thread.sleep(pauseTime);
        taskSessionService.unpauseSession(task.getTaskId());
        List<LocalDateTime> newDueDates = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream().map(ScheduledJob::getDueDate).toList();
        for (LocalDateTime date:newDueDates) {
            System.out.println(date);
        }
        for (int i = 0; i < oldDueDates.size(); i++) {
            assertEquals(oldDueDates.get(i).plusSeconds(pauseTime/1000), newDueDates.get(i));
        }
    }
    public Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setName("Do chores");
        taskRequest.setDescription("Vacuum nasty room");
        taskRequest.setScheduledPerformDateTime("2017-01-13T17:09:42.411");

        return taskService.createTask(taskRequest, TEST_USER_ID);
    }
}
