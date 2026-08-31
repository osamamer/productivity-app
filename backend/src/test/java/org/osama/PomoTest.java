package org.osama;

import jakarta.transaction.Transactional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.pomodoro.PomodoroRepository;
import org.osama.pomodoro.PomodoroService;
import org.osama.pomodoro.PomodoroPhase;
import org.osama.scheduling.JobType;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.ScheduleService;
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
import org.springframework.transaction.annotation.Propagation;

import java.time.LocalDateTime;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
@Execution(ExecutionMode.SAME_THREAD)
public class PomoTest {

    private String testUserId;

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
    private ScheduleService scheduleService;
    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        testUserId = "test-user-" + UUID.randomUUID();
        User testUser = User.builder()
                .id(testUserId)
                .email(testUserId + "@test.com")
                .firstName("Test")
                .lastName("User")
                .username(testUserId)
                .active(true)
                .build();
        userRepository.save(testUser);
    }

    @AfterEach
    void tearDown() {
        pomodoroService.getActivePomodoro(testUserId)
                .ifPresent(pomodoro -> pomodoroService.endPomodoro(
                        pomodoro.getAssociatedTaskId(), testUserId));
    }


    @Test
    void pomoSchedulingLogicWorks() throws InterruptedException {
        Task task = createTask();
        int focusDuration = 5;
        int shortBreakDuration = 1;
        int longBreakDuration = 2;
        int numFocuses = 3;
        int longBreakCooldown = 2;
        pomodoroService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown, testUserId);
    }

    @Test
    void secondsModeSchedulesPomodoroDurationsInSeconds() {
        Task task = createTask();
        pomodoroService.createPomodoro(task.getTaskId(), 10, 10, 10, 2, 4, testUserId);

        scheduleService.schedulePomoJobs(task.getTaskId(), true);

        List<ScheduledJob> jobs = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream()
                .sorted(java.util.Comparator.comparing(ScheduledJob::getDueDate))
                .toList();
        assertEquals(3, jobs.size());
        assertDurationAroundTenSeconds(jobs.get(0).getDueDate(), LocalDateTime.now());
        assertDurationAroundTenSeconds(jobs.get(1).getDueDate(), jobs.get(0).getDueDate());
        assertDurationAroundTenSeconds(jobs.get(2).getDueDate(), jobs.get(1).getDueDate());
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = Propagation.NOT_SUPPORTED)
    void pomodoroStartsInACommittedFocusSession() {
        Task task = createTask();

        pomodoroService.startPomodoro(task.getTaskId(), 25, 5, 15, 4, 4, testUserId);

        var pomodoro = pomodoroRepository
                .findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(task.getTaskId(), testUserId)
                .orElseThrow();
        assertTrue(pomodoro.isSessionActive());
        assertTrue(pomodoro.isSessionRunning());
        assertEquals(1, pomodoro.getCurrentFocusNumber());
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
                () -> pomodoroService.startPomodoro(task.getTaskId(), 0, 5, 15, 4, 4, testUserId));
        assertFalse(pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(task.getTaskId()).isPresent());
        assertTrue(scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).isEmpty());
    }

    @Test
    void userHasAtMostOneActivePomodoroAcrossTasks() {
        Task firstTask = createTask();
        Task secondTask = createTask();
        pomodoroService.startPomodoro(firstTask.getTaskId(), 25, 5, 15, 4, 4, testUserId);

        assertEquals(firstTask.getTaskId(), pomodoroService.getActivePomodoro(testUserId)
                .orElseThrow()
                .getAssociatedTaskId());
        assertThrows(IllegalStateException.class,
                () -> pomodoroService.startPomodoro(secondTask.getTaskId(), 25, 5, 15, 4, 4, testUserId));
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = Propagation.NOT_SUPPORTED)
    void endedPomodoroCanBeRestartedForTheSameTask() {
        Task task = createTask();
        pomodoroService.startPomodoro(task.getTaskId(), 25, 5, 15, 4, 4, testUserId);
        String firstPomodoroId = pomodoroService.getActivePomodoro(testUserId)
                .orElseThrow()
                .getPomodoroId();

        pomodoroService.endPomodoro(task.getTaskId(), testUserId);
        pomodoroService.startPomodoro(task.getTaskId(), 25, 5, 15, 4, 4, testUserId);

        var restartedPomodoro = pomodoroService.getActivePomodoro(testUserId).orElseThrow();
        assertFalse(firstPomodoroId.equals(restartedPomodoro.getPomodoroId()));
        assertEquals(task.getTaskId(), restartedPomodoro.getAssociatedTaskId());
        assertTrue(restartedPomodoro.isSessionActive());
        assertTrue(restartedPomodoro.isSessionRunning());
        assertEquals(1, restartedPomodoro.getCurrentFocusNumber());
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
        pomodoroService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown, testUserId);
        List<LocalDateTime> oldDueDates = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream().map(ScheduledJob::getDueDate).toList();;
        Thread.sleep(1000);
        taskSessionService.pauseSession(task.getTaskId());
        Thread.sleep(pauseTime);
        taskSessionService.unpauseSession(task.getTaskId());
        List<LocalDateTime> newDueDates = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream().map(ScheduledJob::getDueDate).toList();
        for (LocalDateTime date:newDueDates) {
            System.out.println(date);
        }
        Duration actualShift = Duration.between(oldDueDates.get(0), newDueDates.get(0));
        assertTrue(actualShift.toMillis() >= pauseTime && actualShift.toMillis() < pauseTime + 500);
        for (int i = 0; i < oldDueDates.size(); i++) {
            assertEquals(actualShift, Duration.between(oldDueDates.get(i), newDueDates.get(i)));
        }
    }

    @Test
    void resumingDoesNotReactivateCompletedJobs() {
        Task task = createTask();
        pomodoroService.createPomodoro(task.getTaskId(), 10, 10, 10, 2, 4, testUserId);
        scheduleService.schedulePomoJobs(task.getTaskId(), true);

        List<ScheduledJob> jobs = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream()
                .sorted(java.util.Comparator.comparing(ScheduledJob::getDueDate))
                .toList();
        ScheduledJob completedJob = jobs.get(0);
        LocalDateTime completedDueDate = LocalDateTime.now().minusSeconds(1);
        completedJob.setDueDate(completedDueDate);
        completedJob.setScheduled(false);
        scheduledJobRepository.save(completedJob);

        LocalDateTime pauseStartedAt = LocalDateTime.now();
        scheduleService.unscheduleTaskJobs(task.getTaskId());
        scheduleService.resumeTaskJobs(task.getTaskId(), pauseStartedAt, Duration.ofSeconds(5));

        ScheduledJob unchangedCompletedJob = scheduledJobRepository.findById(completedJob.getJobId()).orElseThrow();
        assertFalse(unchangedCompletedJob.isScheduled());
        assertEquals(completedDueDate, unchangedCompletedJob.getDueDate());
        assertTrue(scheduledJobRepository.findAllByScheduledIsTrueAndAssociatedTaskId(task.getTaskId()).size() > 0);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = Propagation.NOT_SUPPORTED)
    void endingAnAutomaticBreakEarlyPreservesTheNextFocusDuration() {
        Task task = createTask();
        pomodoroService.startPomodoro(task.getTaskId(), 10, 10, 20, 3, 2, true, testUserId);

        ScheduledJob firstFocusEnd = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(task.getTaskId())
                .stream()
                .min(java.util.Comparator.comparing(ScheduledJob::getDueDate))
                .orElseThrow();
        firstFocusEnd.setScheduled(false);
        scheduledJobRepository.save(firstFocusEnd);
        taskSessionService.endSession(task.getTaskId());

        pomodoroService.finishBreakEarly(task.getTaskId(), testUserId);

        var pomodoro = pomodoroRepository
                .findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(task.getTaskId(), testUserId)
                .orElseThrow();
        List<ScheduledJob> pendingJobs = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(task.getTaskId())
                .stream()
                .sorted(java.util.Comparator.comparing(ScheduledJob::getDueDate))
                .toList();
        assertEquals(PomodoroPhase.FOCUS, pomodoro.getPhase());
        assertEquals(2, pomodoro.getCurrentFocusNumber());
        assertEquals(3, pendingJobs.size());
        assertEquals(JobType.END_SESSION, pendingJobs.get(0).getJobType());
        assertDurationAroundTenSeconds(pendingJobs.get(0).getDueDate(), LocalDateTime.now());
    }
    public Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setName("Do chores");
        taskRequest.setDescription("Vacuum nasty room");
        taskRequest.setScheduledPerformDateTime("2017-01-13T17:09:42.411");

        return taskService.createTask(taskRequest, testUserId);
    }

    private void assertDurationAroundTenSeconds(LocalDateTime later, LocalDateTime earlier) {
        long durationMillis = java.time.Duration.between(earlier, later).toMillis();
        assertTrue(durationMillis >= 9_500 && durationMillis <= 10_500,
                "expected about 10 seconds but was " + durationMillis + " ms");
    }
}
