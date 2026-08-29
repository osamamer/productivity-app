package org.osama.pomodoro;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.osama.requests.NewTaskRequest;
import org.osama.scheduling.JobType;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.session.task.TaskSessionService;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class PomodoroManualStartTest {

    private String userId;

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
    @Autowired
    private TaskSessionService taskSessionService;

    @BeforeEach
    void setUp() {
        userId = "manual-pomodoro-user-" + UUID.randomUUID();
        userRepository.save(User.builder()
                .id(userId)
                .email(userId + "@test.com")
                .firstName("Manual")
                .lastName("Pomodoro")
                .username(userId)
                .active(true)
                .autoStartPomodoroSessions(false)
                .build());
    }

    @AfterEach
    void tearDown() {
        pomodoroService.getActivePomodoro(userId)
                .ifPresent(pomodoro -> pomodoroService.endPomodoro(pomodoro.getAssociatedTaskId(), userId));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void manualModeStartsOnlyTheCurrentFocusAndWaitsBeforeTheNextPhase() {
        Task task = createTask();

        pomodoroService.startPomodoro(task.getTaskId(), 25, 5, 15, 2, 4, false, userId);

        Pomodoro pomodoro = pomodoroRepository
                .findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(task.getTaskId(), userId)
                .orElseThrow();
        List<ScheduledJob> jobs = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId());

        assertFalse(pomodoro.isAutoStartSessions());
        assertEquals(PomodoroPhase.FOCUS, pomodoro.getPhase());
        assertTrue(pomodoro.isSessionActive());
        assertEquals(1, jobs.size());
        assertEquals(JobType.END_SESSION, jobs.get(0).getJobType());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void singleFocusManualPomodoroSchedulesItsOwnCompletion() {
        Task task = createTask();

        pomodoroService.startPomodoro(task.getTaskId(), 25, 5, 15, 1, 4, false, userId);

        List<ScheduledJob> jobs = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId());
        assertEquals(1, jobs.size());
        assertEquals(JobType.END_POMODORO, jobs.get(0).getJobType());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void endingBreakEarlyStartsTheNextFocusAndSchedulesItsCompletion() {
        Task task = createTask();
        pomodoroService.startPomodoro(task.getTaskId(), 25, 5, 15, 2, 4, false, userId);

        ScheduledJob firstFocusEnd = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(task.getTaskId())
                .get(0);
        firstFocusEnd.setScheduled(false);
        scheduledJobRepository.save(firstFocusEnd);
        taskSessionService.endSession(task.getTaskId());
        pomodoroService.startNextPhase(task.getTaskId(), userId);

        pomodoroService.finishBreakEarly(task.getTaskId(), userId);

        Pomodoro pomodoro = pomodoroRepository
                .findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(task.getTaskId(), userId)
                .orElseThrow();
        List<ScheduledJob> pendingJobs = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(task.getTaskId());
        assertEquals(PomodoroPhase.FOCUS, pomodoro.getPhase());
        assertTrue(pomodoro.isSessionActive());
        assertTrue(pomodoro.isSessionRunning());
        assertEquals(2, pomodoro.getCurrentFocusNumber());
        assertEquals(1, pendingJobs.size());
        assertEquals(JobType.END_POMODORO, pendingJobs.get(0).getJobType());
    }

    private Task createTask() {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Manual Pomodoro task");
        request.setDescription("Wait for the next phase");
        request.setScheduledPerformDateTime("2017-01-13T17:09:42.411");
        return taskService.createTask(request, userId);
    }
}
