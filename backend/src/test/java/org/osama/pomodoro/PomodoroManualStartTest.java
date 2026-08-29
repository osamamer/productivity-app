package org.osama.pomodoro;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.osama.requests.NewTaskRequest;
import org.osama.scheduling.JobType;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class PomodoroManualStartTest {

    private static final String USER_ID = "manual-pomodoro-user";

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private TaskService taskService;
    @Autowired
    private PomodoroService pomodoroService;
    @Autowired
    private PomodoroRepository pomodoroRepository;
    @Autowired
    private ScheduledJobRepository scheduledJobRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(USER_ID)
                .email("manual-pomodoro@test.com")
                .firstName("Manual")
                .lastName("Pomodoro")
                .username("manualpomodoro")
                .active(true)
                .autoStartPomodoroSessions(false)
                .build());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.AFTER_METHOD)
    void manualModeStartsOnlyTheCurrentFocusAndWaitsBeforeTheNextPhase() {
        Task task = createTask();

        pomodoroService.startPomodoro(task.getTaskId(), 25, 5, 15, 2, 4, false, USER_ID);

        Pomodoro pomodoro = pomodoroRepository
                .findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(task.getTaskId(), USER_ID)
                .orElseThrow();
        List<ScheduledJob> jobs = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId());

        assertFalse(pomodoro.isAutoStartSessions());
        assertEquals(PomodoroPhase.FOCUS, pomodoro.getPhase());
        assertTrue(pomodoro.isSessionActive());
        assertEquals(1, jobs.size());
        assertEquals(JobType.END_SESSION, jobs.get(0).getJobType());
    }

    private Task createTask() {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Manual Pomodoro task");
        request.setDescription("Wait for the next phase");
        request.setScheduledPerformDateTime("2017-01-13T17:09:42.411");
        return taskService.createTask(request, USER_ID);
    }
}
