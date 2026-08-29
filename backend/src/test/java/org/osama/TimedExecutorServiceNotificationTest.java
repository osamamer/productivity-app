package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.osama.pomodoro.PomodoroService;
import org.osama.pomodoro.PomodoroTransition;
import org.osama.pomodoro.PomodoroTransitionNotification;
import org.osama.scheduling.JobType;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.TimedExecutorService;
import org.osama.session.task.TaskSessionService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TimedExecutorServiceNotificationTest {

    @Mock
    private ScheduledJobRepository scheduledJobRepository;
    @Mock
    private TaskSessionService taskSessionService;
    @Mock
    private PomodoroService pomodoroService;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private TimedExecutorService timedExecutorService;

    @BeforeEach
    void setUp() {
        timedExecutorService = new TimedExecutorService(
                scheduledJobRepository,
                taskSessionService,
                pomodoroService,
                taskRepository,
                userRepository,
                messagingTemplate
        );
    }

    @Test
    void notifiesWhenFocusEndsAutomatically() {
        runJob(JobType.END_SESSION);

        verify(taskSessionService).endSession("task-1");
        verifyNotification(PomodoroTransition.FOCUS_ENDED);
    }

    @Test
    void notifiesWhenBreakEndsAutomatically() {
        runJob(JobType.START_SESSION);

        verify(pomodoroService).advanceFromBreak("task-1");
        verifyNotification(PomodoroTransition.BREAK_ENDED);
    }

    @Test
    void notifiesWhenPomodoroEndsAutomatically() {
        runJob(JobType.END_POMODORO);

        verify(pomodoroService).endPomodoro("task-1");
        verifyNotification(PomodoroTransition.POMODORO_ENDED);
    }

    @Test
    void doesNotNotifyForUserControlJobs() {
        runJob(JobType.PAUSE_SESSION);

        verify(taskSessionService).pauseSession("task-1");
        verifyNoInteractions(messagingTemplate);
    }

    private void runJob(JobType jobType) {
        ScheduledJob job = new ScheduledJob();
        job.setJobId("job-1");
        job.setJobType(jobType);
        job.setAssociatedTaskId("task-1");
        job.setUserId("user-1");
        job.setDueDate(LocalDateTime.now());
        job.setScheduled(true);

        User user = new User();
        user.setKeycloakId("keycloak-user-1");
        job.setUser(user);

        Task task = new Task();
        task.setName("Write tests");
        when(scheduledJobRepository.findAllByScheduledIsTrueAndDueDateBetween(
                any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(List.of(job));
        if (jobType == JobType.END_SESSION || jobType == JobType.START_SESSION || jobType == JobType.END_POMODORO) {
            when(taskRepository.findTaskByTaskId("task-1")).thenReturn(Optional.of(task));
            when(userRepository.findUserById("user-1")).thenReturn(Optional.of(user));
        }

        timedExecutorService.run();
    }

    private void verifyNotification(PomodoroTransition transition) {
        verify(messagingTemplate).convertAndSendToUser(
                eq("keycloak-user-1"),
                eq("/queue/pomodoro"),
                eq(new PomodoroTransitionNotification(
                        "job-1", "task-1", "Write tests", transition
                ))
        );
    }
}
