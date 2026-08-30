package org.osama.scheduling;

import lombok.extern.slf4j.Slf4j;
import org.osama.pomodoro.PomodoroService;
import org.osama.pomodoro.PomodoroTransition;
import org.osama.reminder.NotificationService;
import org.osama.session.task.TaskSessionService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.function.Consumer;

@Service
@Slf4j
public class ScheduledJobExecutor {
    private final ScheduledJobRepository scheduledJobRepository;
    private final TaskSessionService taskSessionService;
    private final PomodoroService pomodoroService;
    private final TaskRepository taskRepository;
    private final NotificationService notificationService;

    public ScheduledJobExecutor(ScheduledJobRepository scheduledJobRepository,
                                TaskSessionService taskSessionService,
                                PomodoroService pomodoroService,
                                TaskRepository taskRepository,
                                NotificationService notificationService) {
        this.scheduledJobRepository = scheduledJobRepository;
        this.taskSessionService = taskSessionService;
        this.pomodoroService = pomodoroService;
        this.taskRepository = taskRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public void execute(String jobId) {
        ScheduledJob job = scheduledJobRepository.lockByJobId(jobId).orElse(null);
        if (job == null || !job.isScheduled() || job.getDueDate().isAfter(LocalDateTime.now())) {
            return;
        }

        Consumer<String> handler = handlers().get(job.getJobType());
        if (handler == null) {
            throw new IllegalStateException("Scheduled job has no handler: " + job.getJobType());
        }

        job.setScheduled(false);
        handler.accept(job.getAssociatedTaskId());
        persistTransitionNotification(job);
        log.info("Scheduled job completed: jobId={} jobType={} taskId={}",
                job.getJobId(), job.getJobType(), job.getAssociatedTaskId());
    }

    private void persistTransitionNotification(ScheduledJob job) {
        PomodoroTransition transition = switch (job.getJobType()) {
            case END_SESSION -> PomodoroTransition.FOCUS_ENDED;
            case START_SESSION -> PomodoroTransition.BREAK_ENDED;
            case END_POMODORO -> PomodoroTransition.POMODORO_ENDED;
            default -> null;
        };
        if (transition == null) {
            return;
        }

        String taskName = taskRepository.findTaskByTaskId(job.getAssociatedTaskId())
                .map(Task::getName)
                .orElse("Pomodoro task");
        notificationService.createPomodoroNotification(job, taskName, transition);
    }

    private Map<JobType, Consumer<String>> handlers() {
        return Map.of(
                JobType.START_SESSION, pomodoroService::advanceFromBreak,
                JobType.END_SESSION, taskSessionService::endSession,
                JobType.PAUSE_SESSION, taskSessionService::pauseSession,
                JobType.UNPAUSE_SESSION, taskSessionService::unpauseSession,
                JobType.END_POMODORO, pomodoroService::endPomodoro
        );
    }
}
